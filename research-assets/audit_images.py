"""Read-only image validation; writes only a separate inventory report."""
from pathlib import Path
from hashlib import sha256
from collections import Counter
import json
from PIL import Image

root = Path(__file__).resolve().parent
items = []
for path in sorted(root.rglob('*')):
    if path.suffix.lower() not in {'.webp', '.png', '.jpg', '.jpeg'}:
        continue
    item = {'path': path.relative_to(root).as_posix(), 'bytes': path.stat().st_size,
            'sha256': sha256(path.read_bytes()).hexdigest()}
    try:
        with Image.open(path) as img:
            item.update(width=img.width, height=img.height, format=img.format)
            img.verify()
        item['valid'] = True
    except Exception as error:
        item.update(valid=False, error=type(error).__name__)
    items.append(item)
counts = Counter(item['sha256'] for item in items)
report = {'fileCount': len(items), 'validFiles': sum(i['valid'] for i in items),
          'distinctByteHashes': len(counts), 'totalBytes': sum(i['bytes'] for i in items),
          'note': 'File integrity and dimensions only; not a card count, source attribution check, or transcription validation.',
          'images': items}
(root / 'image-integrity.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k: v for k, v in report.items() if k != 'images'}, ensure_ascii=False))
