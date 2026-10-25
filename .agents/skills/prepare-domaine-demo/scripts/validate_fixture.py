#!/usr/bin/env python3
"""Vérifie les données et un modèle de référence ; ne teste pas l'application."""
from pathlib import Path
from copy import deepcopy
from fractions import Fraction
import json

FIXTURE = Path(__file__).resolve().parent.parent / "demo-fixture.json"
def initial(f):
    return {"lots": {x["id"]:deepcopy(x) for x in f["wineLots"]},
            "goods":deepcopy(f["dryGoods"]),
            "batches":{x["batchId"]:{"physical":x["quantity"],"reserved":x["reserved"],"quality":x["quality"],"origins":[]} for x in f["openingBottledStocks"]},
            "orders":{},"shipments":{},"invoices":{},"processed":{}}

def apply(state, action):
    # Copy-on-write reference model: failure leaves the original state untouched.
    s=deepcopy(state); a=deepcopy(action); ident=a["id"]
    if ident in s["processed"]:
        if s["processed"][ident] != a: raise ValueError("idempotency conflict")
        return s
    kind=a["type"]
    if kind=="blend":
        assert a["outputLotId"] not in s["lots"]
        assert len({x["lotId"] for x in a["inputs"]})==len(a["inputs"])
        assert sum(x["volumeMl"] for x in a["inputs"])==a["volumeMl"]>0
        cost=Fraction(0); origins=set(); vintages=set()
        for x in a["inputs"]:
            lot=s["lots"][x["lotId"]]; v=x["volumeMl"]
            assert lot["quality"]=="released" and 0<v<=lot["volumeMl"]
            assert lot["knownCostCents"] is not None
            allocation=Fraction(lot["knownCostCents"])*v/lot["volumeMl"]
            lot["volumeMl"]-=v; lot["knownCostCents"]=Fraction(lot["knownCostCents"])-allocation
            cost+=allocation; origins.update(lot["origins"]);vintages.add(lot["vintage"])
        assert len(vintages)==1  # Fixture scope only, not an appellation rule.
        s["lots"][a["outputLotId"]]={"volumeMl":a["volumeMl"],"knownCostCents":cost,"quality":"released","origins":sorted(origins),"vintage":vintages.pop()}
    elif kind=="bottle":
        lot=s["lots"][a["lotId"]]; volume=a["inputVolumeMl"]
        assert lot["quality"]=="released" and 0<volume<=lot["volumeMl"]
        assert a["bottles"]>0 and a["lossMl"]>=0
        assert volume==a["bottles"]*a["bottleSizeMl"]+a["lossMl"]
        assert a["batchId"] not in s["batches"]
        for key,q in a["materials"].items(): assert 0<=q<=s["goods"][key]
        cost=Fraction(lot["knownCostCents"])*volume/lot["volumeMl"]
        for key,q in a["materials"].items(): s["goods"][key]-=q
        lot["volumeMl"]-=volume;lot["knownCostCents"]=Fraction(lot["knownCostCents"])-cost
        s["batches"][a["batchId"]]={"physical":a["bottles"],"reserved":0,"quality":"released","origins":deepcopy(lot["origins"]),"knownCostCents":cost+a["additionalKnownCostCents"]}
    elif kind=="reserve":
        b=s["batches"][a["batchId"]];q=a["quantity"]
        assert b["quality"]=="released" and 0<q<=b["physical"]-b["reserved"]
        assert a["orderId"] not in s["orders"]
        b["reserved"]+=q;s["orders"][a["orderId"]]={"remaining":q,"batchId":a["batchId"]}
    elif kind=="ship":
        b=s["batches"][a["batchId"]];o=s["orders"][a["orderId"]];q=a["quantity"]
        assert b["quality"]=="released" and o["batchId"]==a["batchId"]
        assert 0<q<=min(o["remaining"],b["reserved"],b["physical"])
        b["physical"]-=q;b["reserved"]-=q;o["remaining"]-=q
        s["shipments"][ident]={"quantity":q,"batchId":a["batchId"],"invoiced":False}
    elif kind=="demo-invoice":
        shipment=s["shipments"][a["shipmentId"]]
        assert not shipment["invoiced"] and a["quantity"]==shipment["quantity"]
        assert a["unitPriceHtCents"]>=0 and a["vatBasisPoints"]>=0
        ht=a["quantity"]*a["unitPriceHtCents"]
        # Positive values, half-up to cents, exact integer arithmetic.
        vat=(ht*a["vatBasisPoints"]+5000)//10000
        s["invoices"][ident]={"htCents":ht,"vatCents":vat,"ttcCents":ht+vat,"paidCents":0}
        shipment["invoiced"]=True
    elif kind=="demo-payment":
        inv=s["invoices"][a["invoiceId"]];q=a["amountCents"]
        assert 0<q<=inv["ttcCents"]-inv["paidCents"]
        inv["paidCents"]+=q
    else: raise ValueError("unknown action")
    s["processed"][ident]=a
    return s

def must_reject(state, action):
    before=deepcopy(state)
    try: apply(state, action)
    except (AssertionError,ValueError): pass
    else: raise AssertionError("Expected refusal")
    assert state==before

def main():
    f=json.loads(FIXTURE.read_text(encoding="utf-8"));s=initial(f);exp=f["expected"]
    origin_ids={o["id"] for o in f["origins"]}
    for lot in f["wineLots"]:
        assert set(lot["origins"])<=origin_ids and lot["volumeMl"]>=0
    occupancy={}
    for x in f["occupancies"]:
        assert 0<x["volumeMl"]<=x["capacityMl"] and x["lotId"] in s["lots"]
        occupancy[x["lotId"]]=occupancy.get(x["lotId"],0)+x["volumeMl"]
    for key,v in occupancy.items():assert v==s["lots"][key]["volumeMl"]
    blend=f["actions"][0];s=apply(s,blend)
    assert s["lots"]["lot-2025-blend"]["knownCostCents"]==exp["blendKnownCostCents"]
    assert set(s["lots"]["lot-2025-blend"]["origins"])==origin_ids
    # Source lot costs remain attached to their unconsumed wine.
    assert s["lots"]["lot-2025-a"]["knownCostCents"]==40000
    assert s["lots"]["lot-2025-b"]["knownCostCents"]==30000
    bottle=f["actions"][1];insufficient=deepcopy(s);insufficient["goods"]["closure"]=1
    must_reject(insufficient,bottle)
    invalid=deepcopy(bottle);invalid["lossMl"]=0;must_reject(s,invalid)
    s=apply(s,bottle)
    b=s["batches"]["batch-2025-01"]
    assert b["knownCostCents"]==exp["bottledKnownCostCents"]
    assert set(b["origins"])==origin_ids
    blocked=deepcopy(s);blocked["batches"]["batch-2025-01"]["quality"]="held"
    must_reject(blocked,f["actions"][2])
    too_many=deepcopy(f["actions"][2]);too_many["quantity"]=661;must_reject(s,too_many)
    for action in f["actions"][2:]:
        before=deepcopy(s)
        s=apply(s,action)
        if action["type"]=="demo-invoice":assert s["batches"]==before["batches"]
    for action in f["actions"]:assert apply(s,action)==s
    conflict=deepcopy(bottle);conflict["bottles"]=1;must_reject(s,conflict)
    for key,v in exp["wineVolumesMl"].items():assert s["lots"][key]["volumeMl"]==v
    b=s["batches"]["batch-2025-01"]
    actual={"physical":b["physical"],"reserved":b["reserved"],"available":b["physical"]-b["reserved"]}
    assert actual==exp["bottledBatch"] and s["goods"]==exp["dryGoods"]
    inv=deepcopy(s["invoices"]["invoice-01"]);inv["balanceCents"]=inv["ttcCents"]-inv["paidCents"]
    assert inv==exp["invoice"]
    assert s["batches"]["batch-2023-old"]["physical"]==exp["unaffected2023Physical"]
    assert sum(x["volumeMl"] for x in f["wineLots"])==sum(x["volumeMl"] for x in s["lots"].values())+660*750+5000
    print("OK — fixture ERP, références, volumes, filiation, coûts, matières, réservations, livraison, facture, règlement, rejets et idempotence. Ne valide pas l'app.")

if __name__=="__main__":main()
