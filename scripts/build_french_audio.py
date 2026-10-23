#!/usr/bin/env python3
"""Offline build of reusable French audio clips. Requires Piper CLI + licensed fr_FR model.
Example: python scripts/build_french_audio.py --model /path/fr_FR-siwis-medium.onnx
This script never edits source syllabus files or existing student progress.
"""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def normalize(s):
    return re.sub(r"\s+"," ",str(s).strip()).casefold()
def phrases(root):
    values=set()
    config=json.loads((root/"config.json").read_text(encoding="utf-8"))
    for file in config["weeks"]:
        data=json.loads((root/file).read_text(encoding="utf-8"))
        for day in data.get("days",[]):
            for item in day.get("vocab",[]):
                if isinstance(item,list) and item and isinstance(item[0],str):values.add(item[0])
            for item in day.get("verbs",[]):
                if isinstance(item,dict) and isinstance(item.get("fr"),str):values.add(item["fr"])
            for section in day.get("conjugations",[]):
                values.update(x for x in section.get("forms",[]) if isinstance(x,str))
            for item in day.get("fixed",[]):
                if isinstance(item,str):values.add(item.split(" — ")[0])
            for section in ["recall","drills","sentences","changes","exit","oral"]:
                for item in day.get(section,[]):
                    if isinstance(item,list) and len(item)>1 and isinstance(item[1],str):values.add(item[1])
                    if isinstance(item,dict) and isinstance(item.get("answer"),str):values.add(item["answer"])
    storyfile=root/"stories.json"
    if storyfile.exists():
        stories=json.loads(storyfile.read_text(encoding="utf-8"))
        for item in stories.get("days",[]):
            text=item.get("text","")
            values.update(s.strip() for s in re.findall(r"[^.!?]+[.!?]+|[^.!?]+$",text) if s.strip())
        values.update(k for k in stories.get("glossary",{}) if k)
    return sorted({v.strip() for v in values if isinstance(v,str) and v.strip()},key=normalize)
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--model",required=True,help="Path to Piper French .onnx model")
    ap.add_argument("--piper",default="piper")
    ap.add_argument("--limit",type=int,default=0,help="Optional clip limit for testing")
    args=ap.parse_args()
    model=Path(args.model).expanduser().resolve()
    if not model.is_file():ap.error("Piper model file not found")
    output=ROOT/"audio"/"clips"
    output.mkdir(parents=True,exist_ok=True)
    manifest={}
    items=phrases(ROOT)
    if args.limit>0:items=items[:args.limit]
    for i,phrase in enumerate(items,1):
        key=normalize(phrase)
        name=hashlib.sha256(key.encode("utf-8")).hexdigest()[:20]+".wav"
        target=output/name
        if not target.exists():
            subprocess.run([args.piper,"--model",str(model),"--output_file",str(target)],input=phrase+"\n",text=True,check=True)
        manifest[key]="audio/clips/"+name
        if i%50==0:print(f"Generated {i}/{len(items)}",flush=True)
    (ROOT/"audio"/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Ready:",len(manifest),"audio clips; commit audio/manifest.json and audio/clips/*.wav")
if __name__=="__main__":main()
