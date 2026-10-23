"""Check the packaged Android script routes, not only whether files exist."""
import re,sys,zipfile

with zipfile.ZipFile(sys.argv[1]) as apk:
    html=apk.read('assets/index.html').decode()
    scripts=re.findall(r'<script[^>]*src=["\x27]([^"\x27]+)',html)
    core=apk.read('classes.dex')
    extension=apk.read('classes2.dex')
    # These are the exact allowlist expressions embedded in compiled DEX.
    pattern=core[core.index(b'(firebase-'):].split(b'\0',1)[0].decode()
    marker=b'/(gateway208|drafts208|update-v208)'
    extra=extension[extension.index(marker):].split(b'\0',1)[0].decode() if marker in extension else '(?!)'
    missing=[]
    for src in scripts:
        assert 'assets/'+src in apk.namelist(), 'Missing packaged script: '+src
        literal=('https://appassets.androidplatform.net/'+src).encode() in core
        if not literal and not re.fullmatch(pattern,src) and not re.fullmatch(extra,'/'+src):missing.append(src)
    assert not missing,'Android loader rejects packaged scripts: '+', '.join(missing)
    assert not re.fullmatch(extra,'/other.js')
    assert not re.fullmatch(extra,'/../gateway208.js')
    print('PASS: all '+str(len(scripts))+' entry-point scripts are packaged and accepted by native routes.')
