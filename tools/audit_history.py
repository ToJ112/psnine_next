#!/usr/bin/env python3
"""Verify the frozen source-history evidence; uses only the Python stdlib."""
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def verify():
    manifest = json.loads((ROOT / 'docs/history/manifest.json').read_text())
    commits = manifest['commits']
    expected = {row['sha']: row for row in commits}
    assert len(expected) == len(commits) == manifest['unique_commits'], 'Manifest duplicates'
    review_rows = []
    for batch in ['early', 'late']:
        review_rows.extend(json.loads((ROOT / f'docs/reviews/{batch}.json').read_text()))
    review_counts = Counter(row['sha'] for row in review_rows)
    assert set(review_counts) == set(expected), 'Missing or unexpected review SHA'
    assert all(count == 1 for count in review_counts.values()), 'Duplicate review SHA'
    for row in review_rows:
        assert row['status'] == 'reviewed', f'Incomplete review: {row["sha"]}'
        assert row['summary'] and row['kind'] and isinstance(row['features'], list)
    patch_counts = Counter()
    with gzip.open(ROOT / 'docs/history/commit-patches.jsonl.gz', 'rt') as source:
        for line in source:
            row = json.loads(line)
            sha = row['sha']
            patch = row['patch'].encode()
            assert sha in expected, f'Unknown patch: {sha}'
            assert hashlib.sha256(patch).hexdigest() == expected[sha]['patch_sha256'], sha
            assert len(patch) == expected[sha]['patch_bytes'], f'Patch length: {sha}'
            patch_counts[sha] += 1
    assert set(patch_counts) == set(expected), 'Missing patch'
    assert all(count == 1 for count in patch_counts.values()), 'Duplicate patch'
    for commit in commits:
        assert set(commit['parents']) <= set(expected), f'Missing parent: {commit["sha"]}'
    return {
        'unique_commits': len(expected),
        'review_records': len(review_rows),
        'verified_patch_hashes': len(patch_counts),
        'missing_reviews': 0,
        'duplicate_reviews': 0,
        'upstream_master': sum(c['on_upstream_master'] for c in commits),
        'fork_v2': sum(c['on_fork_v2'] for c in commits),
        'other_branch_or_pr_only': sum(not c['on_fork_v2'] for c in commits),
        'note': 'Structural evidence verification, not an independent semantic review.',
    }


if __name__ == '__main__':
    print(json.dumps(verify(), ensure_ascii=False, indent=2))
