from pathlib import Path
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, PageBreak
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
from pypdf import PdfReader, PdfWriter
root=Path('/Users/rumbaughnam/Desktop/Projects/AllBlue')
base=root/'docs/grants/g-valley-2026'
out=base/'submission';out.mkdir(exist_ok=True)
for name,file in [('SUIT','SUIT-Regular.ttf'),('SUITBold','SUIT-Bold.ttf')]:pdfmetrics.registerFont(TTFont(name,str(root/'assets/fonts'/file)))
s=ParagraphStyle('body',fontName='SUIT',fontSize=10,leading=15,wordWrap='CJK',spaceAfter=5)
h=ParagraphStyle('head',parent=s,fontName='SUITBold',fontSize=16,leading=23,spaceAfter=18,alignment=1)
small=ParagraphStyle('small',parent=s,fontSize=8.5,leading=12)
def p(x,sty=s):return Paragraph(x,sty)
def table(rows,widths):
 t=Table([[p(str(c)) for c in row] for row in rows],colWidths=widths,hAlign='LEFT');t.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.5,colors.HexColor('#777777')),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),('BACKGROUND',(0,0),(0,-1),colors.HexColor('#f1f4f7'))]));return t
story=[]
def sign(recipient):
 story.extend([Spacer(1,15),p('2026년 10월 7일'),p('기 업 명 : 럼바우'),p('대 표 자 : 남상현&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;(인)'),Spacer(1,20),p(recipient)])
story.extend([p('〈서식 1〉 지원신청서',small),p('2026 제10회 G밸리 창업경진대회 지원신청서',h)])
rows=[['신청 기업명','럼바우'],['사업 아이템','프리다이빙 강사의 일정·교육진도·동의서·수업 피드백 통합 관리 서비스 AllBlue'],['구분 / 기술분야','개인사업자 / 기타 (스포츠 교육 운영 소프트웨어)'],['대표자 / 생년월일','남상현 / 1986.02.25'],['웹사이트 / SNS 주소','—'],['사업자등록번호 / 설립일','416-22-86544 / 2025.04.07'],['직원 수','0명 (대표자 1인 별도)'],['기업 본사 주소','서울특별시 구로구 경인로43길 49, 103동 2602호<br/>(고척동, 고척아이파크)'],['대표자 연락처 / e-mail','010-5039-5142 / rumbau.studio@gmail.com'],['담당자 연락처 / e-mail','010-5039-5142 / rumbau.studio@gmail.com (대표자 동일)'],['참가자격 자가진단','제1~9회차 G밸리 창업경진대회 수상여부: X']]
story.extend([table(rows,[133,378]),Spacer(1,12),p('신청서의 내용이 사실임을 확인하며,<br/>『2026 제10회 G밸리 창업경진대회』 참가신청서를 제출합니다.'),p('〈제출서류〉<br/>1. (서식 2) 사업계획서 (※ 최소 5페이지 이상 작성하여 제출)<br/>2. (서식 3) 개인정보 수집 및 이용동의서<br/>3. (서식 4) 대표자 서약서<br/>4. (서식 5) 주관기관 창업기업 보육시설 입주확인서 또는 G밸리 입주기업 확인서(해당시)<br/>5. (붙임 1) 사업자등록증 (※ 예비창업자 제외)<br/>6. (붙임 2) 법인 등기부등본 (※ 법인만 해당)<br/>7. (붙임 3) 직전년도 재무제표 (※ 예비창업자 제외)<br/>8. (붙임 4) 주주명부 (※ 법인만 해당)<br/>9. (붙임 5) IR자료 (※ 선택사항)<br/>※ 지원신청서를 포함한 위 제출서류를 순서대로 하나의 파일로 스캔하여 PDF 파일로 제출<br/>(제출서식 미준수 시 서류심사 대상에서 제외될 수 있음)<br/>※ 접수된 서류는 일체 반환하지 않습니다',ParagraphStyle('checklist',parent=small,fontSize=7.5,leading=9))])
sign('한국산업단지공단 귀하')
story.append(PageBreak())
story.extend([p('〈서식 3〉 개인정보수집 및 이용동의서',small),p('개인정보 수집·이용 동의서',h),table([['소속','럼바우','성명','남상현'],['생년월일','1986.02.25','연락처','010-5039-5142']],[75,180,65,191]),Spacer(1,12),p('본인은 한국산업단지공단의 2026 제10회 G밸리 창업경진대회 프로그램 진행을 위해 개인정보제공이 필요하다는 것을 이해하고 있으며, 이를 위해 “개인정보보호법”등 규정에 따라 아래의 개인정보를 수집이용하는 것에 동의합니다.')])
rows=[['수집 및 이용 항목','가. 성명, 생년월일<br/>나. 연락처, 이메일<br/>다. 사업계획서상 제출된 개인정보 일체<br/>(학력, 근무처명, 재직기간, 직위, 직책, 수행업무, 성과 등의 작성정보)'],['이용 목적','2026 제10회 G밸리창업경진대회 프로그램 운영을 위한 참가신청, 본인확인, 심사진행, 사후관리 목적'],['정보를 수집하는 자','비디씨엑셀러레이터(주)'],['보유기간','5년'],['정보를 제공받는 자','한국산업단지공단, 서울특별시, 금천구, 구로구, 중소벤처기업진흥공단, 신용보증기금, 숭실대학교, KIBA 서울, 비디씨엑셀러레이터'],['제공 항목','가. 성명, 생년월일<br/>나. 연락처, 이메일'],['제공 목적','상금 및 상장, 입주바우처 전달 목적'],['보유기간','목적 달성 후 폐기']]
story.extend([table(rows,[115,396]),Spacer(1,10),p('개인정보의 수집 및 이용에 (□ 동의함　□ 동의하지 않음)<br/>제3자 제공에 (□ 동의함　□ 동의하지 않음)'),p('귀하는 이와 같은 개인정보의 수집 및 이용을 거부할 수 있습니다. 다만, 개인정보의 수집 및 이용에 동의하지 않는 경우 ‘2026 제10회 G밸리 창업경진대회’ 참여에 제한을 받을 수 있습니다.',small),p('본인이 서명날인한 동의서의 복사본은 원본과 동일하게 유효하다는 것을 인정합니다.',small),p('본인은 개인정보의 수집 및 이용에 관한 설명을 모두 이해하였고 이에 동의합니다.',small)])
sign('비디씨엑셀러레이터(주) 귀하')
story.append(PageBreak())
story.extend([p('〈서식 4〉 대표자 서약서',small),p('2026 제10회 G밸리 창업경진대회<br/>참가 기업 대표자 서약서',h)])
text=(base/'sources/application-extracted.txt').read_text()
start=text.index(' ㅇ 본인은 신청일 현재');end=text.index('  2026년',start)
for para in text[start:end].split('\n'):
 para=para.strip()
 if para:story.extend([p(para.replace('ㅇ ','• ',1)),Spacer(1,13)])
sign('한국산업단지공단 귀하')
forms=base/'work/forms-for-signature.pdf'
SimpleDocTemplate(str(forms),pagesize=A4,rightMargin=42,leftMargin=42,topMargin=36,bottomMargin=32).build(story)
r=PdfReader(forms);assert len(r.pages)==3,len(r.pages)
w=PdfWriter();w.add_page(r.pages[0]);w.append(base/'work/render-screenshots-1/AllBlue_Gvalley_business_plan_DRAFT.pdf');w.add_page(r.pages[1]);w.add_page(r.pages[2])
target=out/'참가신청서 등_럼바우_서명전.pdf';w.write(target)
print(target);print('pages',len(w.pages));print('Signature and privacy selections remain blank on pages 1, 8, 9. Forms reconstructed from official content; original HWP retained.')
