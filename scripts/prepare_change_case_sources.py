"""Pin retained T1–T5 evidence into a NEW private source-only research bundle.

No fetch, extraction, Rule creation, or corpus-admission decision occurs here.
Exit 0 means the pinned bundle was written; exit 2 means invalid inputs/output.
"""
from argparse import ArgumentParser
from collections import Counter
from dataclasses import asdict, dataclass
from hashlib import sha256
import json
from pathlib import Path
import sys
from zipfile import BadZipFile, ZipFile

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from navigator.models import SourceDocument
from navigator.source_policy import POLICY_VERSION, source_use


ROOT = Path(__file__).resolve().parents[1]
CAPTURES = ROOT / "docs/platform_sources"
RESEARCH = "supplemental_research_admission_unverified"


@dataclass(frozen=True)
class Selection:
    doc_id: str
    group: str
    role: str
    cases: tuple[str, ...]
    text_sha256: str
    purpose: str


# Human document-kind review of these exact retained bodies, not legal Rules.
# A new version must receive a deliberate review/pin change before this tool accepts it.
SELECTIONS = (
    Selection("D022", "supplied", "legal_text", ("T1",), "0699980875e6bf3d797abd8b734db7d449b295173e33668cc655e3b394c084ed", "Supplied AB325 enactment text; retain original citation ID."),
    Selection("D069", "supplied", "legal_text", ("T3",), "1fdbfb48743a46429c3f47dbd8d08c665739202361661e1a2f19b94bb0ec43a6", "Supplied FAIR enactment text, including scope and effectiveness clauses."),
    Selection("P11_CA_AB325_TEXT", "2026-10-04", "legal_text", ("T1",), "a0c259cbdeb05e966f0b2b3cacbf899db7ffc0119d392d0fcd9fa608bb7f6c58", "Supplemental AB325 version comparison; does not replace D022."),
    Selection("P11_CA_AB325_HISTORY", "2026-10-04", "status_record", ("T1",), "b89c2fcdb90580c9b9016017b222f9261ebaa82bcaaad631364bbfb4b009f6ee", "AB325 legislative events; separate from substantive provisions."),
    Selection("P11_CA_BPC_ART1", "2026-10-04", "legal_text", ("T1",), "2384f2fc2d33b25366bafec58796c99e9abd411446bd61a15ecaea2067329bf5", "Incorporated person definition; full article retained."),
    Selection("P11_CA_BPC_ART2", "2026-10-04", "legal_text", ("T1",), "38414eac4117ee05baa3862e842deee70b9b6a47faa1c22a79d6f2e32cc7ebef", "Codified AB325 text and code effective-date annotation."),
    Selection("P11_CA_BPC_ART3", "2026-10-04", "legal_text", ("T1",), "38bd66c93d6363c00b125620c79e8e967aa7a1f56da16f9ea9769525e63de04a", "Codified AB325/SB763 companion provisions; version review remains required."),
    Selection("P11_CA_CONS_ART4", "2026-10-04", "legal_text", ("T1",), "fc5cd24041f3ab6bf8b5d7bf8c54d8ac3b8743d8e71798211b1468e8ea489661", "General effective-date authority, not a computed bill-specific date."),
    Selection("P11_CA_SB763_TEXT", "2026-10-04", "legal_text", ("T1",), "2d0ae05f9c2e990a86d87e8e94080aca510fe9ab31a1d8a9c45d1ac2f1f75e34", "Chaptered SB763 substantive text."),
    Selection("P11_CA_SB763_HISTORY", "2026-10-04", "status_record", ("T1",), "d5760b35751b382bba28102d11d7d4ac6baf07ec64f018268a0f108a4ad11c53", "SB763 legislative events; not substantive rule text."),
    Selection("P11_NJ_HOB_B781_HTML", "2026-10-04", "legal_text", ("T2", "T3"), "f3316be812ddc9e26641a1adc0787ef39dce5c63d9cfa01054f5a4e0ce3637b5", "Mixed legislative record contains ordinance body; title/body numbering conflict retained."),
    Selection("P11_NJ_HOB_MINUTES", "2026-10-04", "status_record", ("T2", "T3"), "cff215dc6e06b784e8efa305937f1fbffb358257f0bf8bd26ce1e583631499f5", "Council minutes record adoption, not newspaper publication."),
    Selection("P11_NJ_JC_25_057", "2026-10-04", "legal_text", ("T2", "T3"), "95d3aa83c069ff8435e81300986179611bfde3d9e6058a6ed47191e09ccf11a1", "Original Jersey City ordinance; later amendments must be reconciled."),
    Selection("P11_NJ_JC_25_098", "2026-10-04", "legal_text", ("T2", "T3"), "d97d04b52cb030071adb8cdb805f90d4cc4bec05eba4c35aad7beaba7060a768", "Jersey City amendment containing disclosure provisions."),
    Selection("P11_NJ_JC_25_105", "2026-10-04", "legal_text", ("T2", "T3"), "d4b6c44f558164f2e16bc731cf3dae6b1b7c082c410a7335596b314b0da50b4a", "General penalties amendment; do not treat it as algorithmic-rent duties."),
    Selection("P12_NJ_CHARTER", "2026-10-04-followup", "legal_text", ("T2", "T3"), "674ac5befcd070b0c21be28195c212cdfa586ecb0c5697ede8d3d1855e11b484", "Statutory compilation with publication/effectiveness conditions; no ordinance-specific finding."),
    Selection("P11_MA_H5222_TEXT", "2026-10-04", "legal_text", ("T4",), "e00471a91467c4b006c76a013046a38549484acfd3225c03d13fb6028b4ebd6e", "H5222 proposal body, not proof of enactment."),
    Selection("P11_MA_H5222_STATUS", "2026-10-04", "status_record", ("T4",), "6ad96053828823b69a204d8af97116a768766526378ee46982e66928630543c2", "Observed H5222 history/status, separate from proposal provisions."),
    Selection("P11_MA_S2983_TEXT", "2026-10-04", "legal_text", ("T4",), "f13c13cdc504498d3b19473af1dcdc05a1a4ab84e3a10c42c93dbe26de825fb8", "S2983 proposal body, not proof of enactment."),
    Selection("P11_MA_S2983_STATUS", "2026-10-04", "status_record", ("T4",), "9ac8888c7d059eebd0d1bbbf36745987213cd5ab20ab9e6368480f55c270805f", "Observed S2983 history/status, separate from proposal provisions."),
    Selection("P11_MA_IP25_21_ORIGINAL", "2026-10-04", "legal_text", ("T5",), "c628b36b39401730dcbf99c8350e31bc8f91e6f86892cc554253b0f77f1268f2", "Original initiative petition proposal; no operative cap presumed."),
    Selection("P11_MA_H5008", "2026-10-04", "legal_text", ("T5",), "1436cfb89c41b875f5cb69cf52685a723a44671cedc508b3dc6225c9e93b42f5", "Mixed transmission package contains petition body; certification is not present ballot eligibility."),
    Selection("MA_SJC_13893_DOCKET", "2026-10-04-browser", "status_record", ("T5",), "30c4e8bd039432871570f545aba8076fec1f3e975ad62cf81e2b89f7a9c2e07f", "Official appellate docket records rescript and ballot disposition; not the full opinion."),
    Selection("MA_SJ_2026_0063_DOCKET", "2026-10-04-browser", "status_record", ("T5",), "c587b3315248dafd9d6c7edc4b0265c59e875ccd34282f807065423e3f13de82", "Official single-justice docket records judgment; signed judgment not captured."),
)

GAPS = {
    "T1": ["Supplemental California captures require an admission/access decision under the guide's corpus-copy instruction.",
           "Bill history, general date authority and current code must be tied to the requested historical version by evidence; no date/person Rule is created here."],
    "T2": ["Ordinance-specific publication and resulting operative dates remain unresolved. Adoption notices or index modification dates are not publication proof.",
           "Hoboken title/body section numbering differs. Jersey City original and amendments require scope/version reconciliation."],
    "T3": ["D069 timing and any municipal conflict/preemption relationship require automated extraction with evidence; this bundle asserts neither.",
           "Municipal publication/date gaps also affect this comparison. The charter compilation alone does not close them."],
    "T4": ["October 4 captures do not alone establish exact October 1 proposal-version continuity. Proposal text and status history must remain distinct.",
           "Hypothetical enactment is not actual enactment; historical pending status and affected scope still need validated extraction."],
    "T5": ["Official docket text records disposition, but the signed judgment and full opinion were not captured from the official court host.",
           "Petition text and docket lifecycle must be linked by evidence; source availability does not itself create a failed-status Rule."],
}


# Context candidates, not findings that these instruments legally interact.
# Whole minutes/charter texts exceed a bounded extraction request; retain them in
# the source bundle and defer relevant-span review rather than silently truncate.
EXTRACTION_CONTEXT = {
    "D022": ("P11_CA_AB325_TEXT", "P11_CA_AB325_HISTORY", "P11_CA_BPC_ART1", "P11_CA_BPC_ART2", "P11_CA_BPC_ART3", "P11_CA_CONS_ART4"),
    "P11_CA_SB763_TEXT": ("P11_CA_SB763_HISTORY", "P11_CA_BPC_ART1", "P11_CA_BPC_ART3", "P11_CA_CONS_ART4"),
    "D069": ("P11_NJ_HOB_B781_HTML", "P11_NJ_JC_25_057", "P11_NJ_JC_25_098", "P11_NJ_JC_25_105"),
    "P11_NJ_HOB_B781_HTML": (),
    "P11_NJ_JC_25_057": ("P11_NJ_JC_25_098", "P11_NJ_JC_25_105"),
    "P11_NJ_JC_25_098": ("P11_NJ_JC_25_057", "P11_NJ_JC_25_105"),
    "P11_MA_H5222_TEXT": ("P11_MA_H5222_STATUS",),
    "P11_MA_S2983_TEXT": ("P11_MA_S2983_STATUS",),
    "P11_MA_IP25_21_ORIGINAL": ("P11_MA_H5008", "MA_SJC_13893_DOCKET", "MA_SJ_2026_0063_DOCKET"),
}


def _extraction_jobs(sources):
    selections = {s.doc_id: s for s in SELECTIONS}
    jobs = []
    for primary, supporting in sorted(EXTRACTION_CONTEXT.items()):
        deferred = []
        if primary == "D069" or primary.startswith("P11_NJ_"):
            deferred = ["P12_NJ_CHARTER"]
            if primary in {"D069", "P11_NJ_HOB_B781_HTML"}:
                deferred.append("P11_NJ_HOB_MINUTES")
        jobs.append({"doc_id": primary, "supporting_doc_ids": sorted(supporting),
                     "cases": list(selections[primary].cases), "purpose": selections[primary].purpose,
                     "plan_only": True,
                     "context_characters": sum(len(sources[i]["text"]) for i in (primary, *supporting)),
                     "substantive_context_doc_ids": sorted(i for i in supporting if sources[i]["source_type"] == "legal_text"),
                     "temporal_context_doc_ids": sorted(i for i in supporting if sources[i]["source_type"] == "status_record"),
                     "deferred_bounded_span_review_doc_ids": sorted(deferred)})
    return jobs


def _hash(data):
    return sha256(data).hexdigest()


def _json(data):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"Duplicate JSON key: {key}")
            result[key] = value
        return result
    return json.loads(data.decode("utf-8-sig"), object_pairs_hook=unique)


class Inputs:
    def __init__(self):
        self.files = {}

    def read(self, path):
        path = Path(path)
        if path.is_symlink() or not path.is_file():
            raise ValueError(f"Expected regular input file: {path}")
        path = path.resolve()
        if path not in self.files:
            self.files[path] = path.read_bytes()
        return self.files[path]

    def json(self, path):
        return _json(self.read(path))

    def verify_unchanged(self):
        for path, data in self.files.items():
            if path.is_symlink() or not path.is_file() or path.read_bytes() != data:
                raise ValueError(f"Input changed while preparing bundle: {path}")


def _child(root, name):
    path = root / name
    if Path(name).is_absolute() or not path.resolve().is_relative_to(root.resolve()):
        raise ValueError("Capture path escapes its retained bundle")
    return path


def _model(value, ident):
    source = SourceDocument.model_validate(value)
    if source.doc_id != ident or not source.text or source.authority != "official":
        raise ValueError(f"Missing, mismatched or non-official source: {ident}")
    if source.capture_status not in {"supplied", "supplementary"}:
        raise ValueError(f"Source capture is not available for this bundle: {ident}")
    if source.sha256 != _hash(source.text.encode("utf-8")):
        raise ValueError(f"Source text hash mismatch: {ident}")
    return source


def _index(rows, key):
    result = {}
    for row in rows:
        ident = row[key]
        if ident in result:
            raise ValueError(f"Duplicate record: {ident}")
        result[ident] = row
    return result


def prepare(*, output, store=None, archive=None, captures_root=CAPTURES):
    """Validate everything before creating output; return its source manifest."""
    if (store is None) == (archive is None):
        raise ValueError("Provide exactly one input Store or archive")
    captures_root = Path(captures_root).resolve()
    output = Path(output).absolute()
    protected = [captures_root, Path(store).resolve() if store else Path(archive).resolve()]
    if output.exists() or output.is_symlink() or any(output.resolve().is_relative_to(p) for p in protected):
        raise ValueError("Output must be a new directory outside all input paths")
    inputs = Inputs()
    if store:
        source_path = Path(store) / "sources.json"
        original = inputs.json(source_path)
        input_identity = {"kind": "store", "path": str(Path(store).resolve()), "sources_sha256": _hash(inputs.read(source_path))}
    else:
        archive = Path(archive)
        raw_archive = inputs.read(archive)
        # Read the already-pinned archive bytes, without extracting any members.
        from io import BytesIO
        with ZipFile(BytesIO(raw_archive)) as zipped:
            if zipped.namelist().count("sources.json") != 1:
                raise ValueError("Archive needs exactly one root sources.json member")
            raw_sources = zipped.read("sources.json")
        original = _json(raw_sources)
        input_identity = {"kind": "archive", "path": str(archive.resolve()), "archive_sha256": _hash(raw_archive), "sources_sha256": _hash(raw_sources)}
    if not isinstance(original, dict):
        raise ValueError("sources.json must be an object keyed by document ID")

    groups = {}
    output_sources, records, payloads = {}, [], {}
    for selection in SELECTIONS:
        ident, group = selection.doc_id, selection.group
        record, raw_body = None, None
        if group == "supplied":
            source = _model(original[ident], ident)
            if source.capture_status != "supplied":
                raise ValueError(f"Expected original supplied capture: {ident}")
            provenance = {"kind": "supplied_store_text", "raw_response_available": False}
            text_body = source.text.encode("utf-8")
        elif group == "2026-10-04-browser":
            folder = captures_root / group
            if group not in groups:
                groups[group] = (_index(inputs.json(folder / "captures.json"), "id"),
                                 _index(inputs.json(folder / "manifest.json")["files"], "path"))
            captures, files = groups[group]
            capture = captures[ident]
            text_body = inputs.read(_child(folder, capture["text"]))
            record = files[capture["text"]]
            if _hash(text_body) != record["sha256"] or len(text_body) != record["bytes"]:
                raise ValueError(f"Browser text pin mismatch: {ident}")
            source = _model({"doc_id": ident, "jurisdictions": ["MA"], "url": capture["url"],
                             "retrieved_at": capture["captured_at"], "text": text_body.decode("utf-8"),
                             "sha256": _hash(text_body), "capture_status": "supplementary",
                             "authority": "official", "source_type": "status_record",
                             "issues": ["Browser visible text; not original HTTP response bytes.",
                                        "Supplemental research; competition corpus admission unverified.",
                                        "Docket record, not signed judgment or full opinion."]}, ident)
            provenance = {"kind": "retained_browser_visible_text", "capture": capture,
                          "file_record": record, "raw_response_available": False}
        else:
            folder = captures_root / group
            if group not in groups:
                groups[group] = (inputs.json(folder / "sources.json"),
                                 _index(inputs.json(folder / "manifest.json")["records"], "doc_id"))
            sources, rows = groups[group]
            source, record = _model(sources[ident], ident), rows[ident]
            text_body = inputs.read(_child(folder, record["text_path"]))
            raw_body = inputs.read(_child(folder, record["raw_path"]))
            if (_hash(text_body) != record["text_sha256"] or text_body.decode("utf-8") != source.text
                    or len(source.text) != record["text_characters"] or _hash(raw_body) != record["raw_sha256"]
                    or len(raw_body) != record["raw_bytes"] or record["http_status"] != 200
                    or source.url != record["url"] or source.retrieved_at != record["retrieved_at"]):
                raise ValueError(f"Retained capture identity mismatch: {ident}")
            if source.capture_status != "supplementary":
                raise ValueError(f"Expected supplemental capture: {ident}")
            provenance = {"kind": "retained_response_and_derived_text", "record": record,
                          "raw_response_available": True, "derivation_reexecuted": False}
        if source.sha256 != selection.text_sha256:
            raise ValueError(f"Reviewed text version pin mismatch: {ident}")
        if group != "supplied" and ident in original:
            existing = _model(original[ident], ident)
            if existing.sha256 != source.sha256 or existing.url != source.url:
                raise ValueError(f"Input Store has a conflicting source ID: {ident}")
            provenance["existing_store_metadata"] = existing.model_dump(exclude={"text"})
        text_path = f"evidence/{ident}/text.txt"
        payloads[text_path] = text_body
        evidence_files = [{"path": text_path, "sha256": _hash(text_body), "bytes": len(text_body), "kind": "source_text"}]
        if raw_body is not None:
            raw_path = f"evidence/{ident}/raw{Path(record['raw_path']).suffix}"
            payloads[raw_path] = raw_body
            evidence_files.append({"path": raw_path, "sha256": _hash(raw_body), "bytes": len(raw_body), "kind": "original_response"})
        # Metadata declaration only; exact text, citation ID, URL and timestamps stay intact.
        declared = source.model_copy(update={"source_type": selection.role})
        output_sources[ident] = declared.model_dump()
        records.append({"doc_id": ident, "cases": list(selection.cases), "admission": "supplied_corpus" if group == "supplied" else RESEARCH,
                        "original_source_metadata": source.model_dump(exclude={"text"}), "provenance": provenance,
                        "declaration": {"source_type": selection.role, "purpose": selection.purpose,
                                        "basis": "Manual document-kind review of the pinned body; no Rule or lifecycle decision"},
                        "source_use": asdict(source_use(declared)), "text_sha256": selection.text_sha256,
                        "files": evidence_files})

    manifest = {"schema_version": 1, "label": "SOURCE_ONLY_RESEARCH_BUNDLE_NOT_A_SUBMISSION",
                "input": input_identity, "source_policy_version": POLICY_VERSION,
                "script_sha256": _hash(Path(__file__).read_bytes()),
                "sources": len(records), "source_roles": dict(sorted(Counter(s.source_type for s in map(SourceDocument.model_validate, output_sources.values())).items())),
                "admission_counts": dict(sorted(Counter(r["admission"] for r in records).items())),
                "rules_created": 0, "provider_calls": 0, "original_stores_modified": False,
                "ready_for_submission": False, "case_readiness": "not_evaluated",
                "extraction_jobs": _extraction_jobs(output_sources),
                "limits": ["Hashes establish retained-byte identity, not legal validity, access permission or organizer admission.",
                           "Supplemental captures remain research even when source-use-v2 calls their document kind eligible_primary.",
                           "No existing Rules, RuleDrafts, extraction caches or provider lineage are copied.",
                           "No raw-to-text rederivation is performed; retained derivatives are pinned independently.",
                           "Large mixed documents require bounded relevant-span review before any later extraction."],
                "remaining_gaps": GAPS, "documents": records,
                "input_files": [{"path": str(p), "sha256": _hash(b), "bytes": len(b)} for p, b in sorted(inputs.files.items())]}
    sources_bytes = (json.dumps(output_sources, indent=2, sort_keys=True, ensure_ascii=False) + "\n").encode("utf-8")
    manifest["sources_json_sha256"] = _hash(sources_bytes)
    payloads["sources.json"] = sources_bytes
    inputs.verify_unchanged()
    output.mkdir(parents=True, mode=0o700, exist_ok=False)
    for name, data in payloads.items():
        destination = output / name
        destination.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
        with destination.open("xb") as stream:
            stream.write(data)
        destination.chmod(0o600)
    destination = output / "manifest.json"
    with destination.open("x", encoding="utf-8") as stream:
        json.dump(manifest, stream, indent=2, sort_keys=True, ensure_ascii=False)
        stream.write("\n")
    destination.chmod(0o600)
    return manifest


def main(argv=None):
    parser = ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--store", type=Path, help="Input Store; only sources.json is read")
    source.add_argument("--archive", type=Path, help="Input ZIP with a root sources.json; no member is extracted")
    parser.add_argument("--output", type=Path, required=True, help="New private directory, outside all input paths")
    parser.add_argument("--captures-root", type=Path, default=CAPTURES, help="Root of the retained tracked capture directories")
    args = parser.parse_args(argv)
    try:
        manifest = prepare(output=args.output, store=args.store, archive=args.archive, captures_root=args.captures_root)
    except (OSError, ValueError, KeyError, TypeError, BadZipFile) as exc:
        print(f"Cannot prepare source bundle: {exc}", file=sys.stderr)
        return 2
    print(json.dumps({"output": str(args.output.resolve()), "sources": manifest["sources"],
                      "admission_counts": manifest["admission_counts"], "ready_for_submission": False}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
