"""Transforma una copia actual de las reglas; nunca despliega ni sobrescribe la entrada."""
from pathlib import Path
import re,sys
if len(sys.argv)!=3:raise SystemExit('Uso: python Aplicar-Proteccion-Firebase.py reglas-actuales.rules reglas-nuevas.rules')
source,target=map(Path,sys.argv[1:])
if source.resolve()==target.resolve() or target.exists():raise SystemExit('Elegí un archivo de salida nuevo. No se modificó nada.')
text=source.read_text(encoding='utf-8')
pattern=r'(match\s+/leagues/main/data/\{document=\*\*\}\s*\{\s*allow\s+read\s*:\s*if\s+true\s*;\s*allow\s+write\s*:\s*if\s+)editor\(\)(\s*;\s*\})'
if len(re.findall(pattern,text))!=1:raise SystemExit('No se encontró exactamente el bloque esperado. Revisá las reglas manualmente; no se modificó nada.')
result=re.sub(pattern,lambda m:m[1]+'owner()'+m[2],text)
target.write_text(result,encoding='utf-8')
print('Copia preparada. Activá y comprobá el servidor antes de publicar estas reglas en Firebase.')
