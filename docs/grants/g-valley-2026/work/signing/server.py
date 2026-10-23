from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
import json, secrets, io, math, os, datetime, subprocess
import pdfplumber
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
BASE=Path(__file__).resolve().parents[2]
SOURCE=BASE/'submission/참가신청서 등_럼바우_서명전.pdf'
OUT=BASE/'submission/참가신청서 등_럼바우.pdf'
TOKEN=secrets.token_urlsafe(24)
PORT=8787
ORIGIN=f'http://127.0.0.1:{PORT}'
BIN=Path('/Users/rumbaughnam/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override')

def make_pdf(strokes, dest):
    pts=[p for s in strokes for p in s]
    x0=min(p[0] for p in pts); y0=min(p[1] for p in pts)
    dx=max(p[0] for p in pts)-x0; dy=max(p[1] for p in pts)-y0
    if dx<15 or dy<8: raise ValueError('서명을 조금 더 크게 그려 주세요.')
    scale=min(58/dx,27/dy)
    reader=PdfReader(SOURCE); writer=PdfWriter()
    with pdfplumber.open(SOURCE) as src:
        for n,page in enumerate(reader.pages):
            if n in (0,7,8):
                meta=src.pages[n]; words=meta.extract_words()
                anchor=next(w for w in words if w['text']=='(인)')
                # Signature centered over the original stamp marker, without covering the name.
                left=(anchor['x0']+anchor['x1'])/2-dx*scale/2
                bottom=meta.height-(anchor['top']+anchor['bottom'])/2-dy*scale/2
                buf=io.BytesIO(); c=canvas.Canvas(buf,pagesize=(meta.width,meta.height))
                c.setStrokeColorRGB(.04,.10,.20);c.setLineWidth(.95);c.setLineCap(1);c.setLineJoin(1)
                for stroke in strokes:
                    if len(stroke)<2:continue
                    path=c.beginPath()
                    path.moveTo(left+(stroke[0][0]-x0)*scale,bottom+(dy-(stroke[0][1]-y0))*scale)
                    for x,y in stroke[1:]:path.lineTo(left+(x-x0)*scale,bottom+(dy-(y-y0))*scale)
                    c.drawPath(path)
                if n==7:
                    boxes=[ch for ch in meta.chars if ch['text']=='□']
                    assert len(boxes)==4
                    for ch in (boxes[0],boxes[2]):
                        x=ch['x0']; y=meta.height-ch['bottom']
                        path=c.beginPath();path.moveTo(x+1,y+5);path.lineTo(x+4,y+2);path.lineTo(x+9,y+11);c.drawPath(path)
                c.save();buf.seek(0);page.merge_page(PdfReader(buf).pages[0])
            writer.add_page(page)
    writer.write(dest)
    assert len(PdfReader(dest).pages)==9

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def reply(self,code,data,typ='application/json; charset=utf-8'):
        if isinstance(data,dict):data=json.dumps(data,ensure_ascii=False).encode()
        elif isinstance(data,str):data=data.encode()
        self.send_response(code);self.send_header('Content-Type',typ);self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store');self.send_header('Referrer-Policy','no-referrer');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(data)
    def valid(self):return self.headers.get('Host')==f'127.0.0.1:{PORT}' and parse_qs(urlsplit(self.path).query).get('key')==[TOKEN]
    def do_GET(self):
        if not self.valid():return self.reply(403,{'error':'이 서명 화면의 링크로 접속해 주세요.'})
        path=urlsplit(self.path).path
        if path=='/':return self.reply(200,(Path(__file__).parent/'index.html').read_text().replace('__TOKEN__',TOKEN),'text/html; charset=utf-8')
        if path in ('/source.pdf','/signed.pdf'):
            f=SOURCE if path=='/source.pdf' else OUT
            if f.exists():return self.reply(200,f.read_bytes(),'application/pdf')
        if path in ('/page1.png','/page8.png','/page9.png'):
            n={'/page1.png':1,'/page8.png':2,'/page9.png':3}[path]
            f=Path(f'/private/tmp/allblue-forms-final-{n}.png')
            if f.exists():return self.reply(200,f.read_bytes(),'image/png')
        self.reply(404,{})
    def do_POST(self):
        if not self.valid() or self.headers.get('Origin')!=ORIGIN or urlsplit(self.path).path!='/save':return self.reply(403,{})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<1000000:raise ValueError('서명 데이터 크기를 확인해 주세요.')
            data=json.loads(self.rfile.read(size))
            if not all(data.get(k) is True for k in ('consent','thirdParty','apply')):raise ValueError('동의와 서명 적용 항목을 확인해 주세요.')
            strokes=data.get('strokes')
            if not isinstance(strokes,list) or not 1<=len(strokes)<=500:raise ValueError('서명을 먼저 그려 주세요.')
            count=0
            for s in strokes:
                if not isinstance(s,list):raise ValueError('서명 형식 오류')
                for p in s:
                    count+=1
                    if not isinstance(p,list) or len(p)!=2 or not all(isinstance(v,(int,float)) and math.isfinite(v) for v in p) or not (0<=p[0]<=900 and 0<=p[1]<=280):raise ValueError('서명 좌표 오류')
            if not 4<=count<=30000:raise ValueError('서명을 다시 확인해 주세요.')
            tmp=OUT.with_name('signature-output.tmp.pdf');make_pdf(strokes,tmp)
            if OUT.exists():
                stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f');OUT.rename(OUT.with_name(f'참가신청서 등_럼바우_이전서명_{stamp}.pdf'))
            os.replace(tmp,OUT)
            qa=BASE/'work/signed-review';qa.mkdir(exist_ok=True)
            for n in (1,8,9):subprocess.run([str(BIN/'pdftoppm'),'-f',str(n),'-l',str(n),'-scale-to','1300','-png',str(OUT),str(qa/'page')],check=True,capture_output=True)
            receipt={'signed_at':datetime.datetime.now().astimezone().isoformat(),'path':str(OUT),'pages':[1,8,9],'privacy_consent':True,'third_party_consent':True,'source':'사용자가 로컬 서명 화면에서 직접 그린 서명을 적용','submitted':False,'visual_review':'렌더링 완료; 사람이 확인하기 전'}
            (BASE/'work/signing/receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
            statefile=BASE/'application-state.json';state=json.loads(statefile.read_text());state['signed_packet']=receipt;state['status']='사용자 직접 서명 및 개인정보 동의 표시 완료. 서명본 검수 후 업로드·제출 진행 필요.';statefile.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n')
            return self.reply(200,{'ok':True,'url':f'/signed.pdf?key={TOKEN}','message':'서명본을 저장했습니다. Codex에 “서명했어”라고 알려 주세요.'})
        except Exception as e:self.reply(400,{'error':str(e)})

if __name__=='__main__':
    server=HTTPServer(('127.0.0.1',PORT),Handler)
    (Path(__file__).parent/'session.json').write_text(json.dumps({'url':ORIGIN+'/?key='+TOKEN,'pid':os.getpid()}))
    server.serve_forever()
