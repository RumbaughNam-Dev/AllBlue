import fs from 'node:fs/promises';
import path from 'node:path';
import {Presentation,PresentationFile} from '@oai/artifact-tool';
import {finalizePresentation} from '/Users/rumbaughnam/.codex/plugins/cache/openai-primary-runtime/presentations/26.1007.11041/skills/presentations/container_tools/artifact_tool_utils.mjs';
const root='/Users/rumbaughnam/Desktop/Projects/AllBlue';
const dir=path.join(root,'docs/grants/ggsports-2026');
const skill='/Users/rumbaughnam/.codex/plugins/cache/openai-primary-runtime/presentations/26.1007.11041/skills/presentations';
const p=Presentation.create({slideSize:{width:1280,height:720}});
function tx(s,text,x,y,w,h,size=28,color='#193C63',bold=false){const t=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});t.text=text;t.text.style={typeface:'SUIT',fontSize:size,color,bold};return t;}
async function slide(title,body,img,notes){const s=p.slides.add();s.background.fill='#F3F7FA';tx(s,title,70,55,1100,115,44,'#174778',true);body.forEach((v,i)=>tx(s,v,75,200+i*135,img?730:1110,115,29));if(img){let b=await fs.readFile('/Users/rumbaughnam/Downloads/allblue_ios/'+img);s.images.add({blob:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),contentType:'image/png',alt:'AllBlue 앱 소개 화면',fit:'contain',position:{left:900,top:155,width:260,height:540}});}tx(s,String(p.slides.items.length).padStart(2,'0'),1190,665,50,30,18);s.speakerNotes.text=notes;return s;}
let s=p.slides.add();s.background.fill='#174778';tx(s,'AllBlue',75,150,1000,110,84,'#FFFFFF',true);tx(s,'프리다이빙 교육을 연결하는\n강사·교육생 운영 서비스',80,300,1100,160,48,'#FFFFFF',true);tx(s,'2026 경기스포츠산업 공모전  |  럼바우 남상현',80,585,1100,70,26,'#FFFFFF');s.speakerNotes.text='[25초] 안녕하세요. 럼바우 대표 남상현입니다. AllBlue는 프리다이빙 강사가 교육 일정과 교육생의 진도, 수업 후 피드백을 함께 관리하는 앱입니다. 오늘은 실제 교육 운영에서 겪은 문제와 구현된 화면을 중심으로 소개하겠습니다.';
await slide('엑셀로 관리하는 프리다이빙 교육',[
'교육생별 진도와 수업 기록을\n엑셀로 정리하는 현장을 보았습니다.',
'다음 수업을 준비할 때 일정과\n지난 피드백을 다시 찾아야 합니다.',
'AllBlue는 교육생을 중심으로\n이 기록을 이어서 확인하게 합니다.'
],'03_feature_1.png','[45초] 개발자인 동시에 프리다이빙을 배우면서 교육 운영을 가까이에서 보았습니다. 강사들이 엑셀로 교육생의 진도를 관리하는 경우가 많았습니다. 이 관찰은 대표자와 협업 강사의 현장 경험이며 업계 전체를 조사한 통계는 아닙니다. 교육생 수가 늘면 이번 수업과 이전 수업의 기록을 연결해서 확인하는 일이 반복됩니다. AllBlue는 이 반복 업무를 줄이는 데서 출발했습니다. 출처: 사용자 제공 현장 관찰 및 앱 화면.');
await slide('일정에서 교육생과 수업 기록까지',[
'날짜와 장소를 기준으로\n교육·트레이닝 일정을 관리합니다.',
'일정에 참여하는 교육생을 연결해\n수업 준비와 참석자 확인을 돕습니다.',
'교육 후에는 같은 흐름에서\n진도와 피드백을 남깁니다.'
],'08_feature_6.png','[45초] 일정만 기록하는 달력과 달리, AllBlue는 일정에 교육생을 연결합니다. 수업 전에 누가 참여하는지 확인하고 수업이 끝나면 해당 교육생의 진도와 피드백으로 이어집니다. 현재 구현된 프리다이빙 교육 운영 흐름을 설명하는 것으로 대회 경기 운영 기능이 이미 구현됐다는 뜻은 아닙니다. 출처: 사용자 앱 화면 및 기존 사업계획서.');
await slide('교육 과정별 진도를 항목으로 관리',[
'AIDA 교육 과정의 개방수역·풀\n요건을 항목별로 확인합니다.',
'강사가 교육생의 진행 상황을 보고\n다음 수업 내용을 준비합니다.',
'기록을 남기는 도구이며,\n교육·자격 판단은 강사가 수행합니다.'
],'05_feature_3.png','[55초] 일반적인 메모앱에서는 강사가 교육과정의 항목을 직접 만들고 관리해야 합니다. AllBlue는 프리다이빙 교육과정의 요건을 교육생별로 확인하는 화면을 제공합니다. 어떤 항목을 진행했는지 보고 다음 수업을 준비할 수 있습니다. 앱은 교육 기록을 관리하며 자격증을 발급하거나 강사의 안전 판단을 대신하지 않습니다. 출처: 사용자 제공 화면.');
await slide('수업 직후 남기는 디브리핑',[
'과정별 통과 항목을 확인하고\n피드백 메모를 함께 저장합니다.',
'오늘 배운 내용과 다음 수업 목표를\n교육생별 기록으로 이어갑니다.',
'시연: 일정 선택 → 교육생 확인\n→ 진도 확인 → 피드백 저장'
],'06_feature_4.png','[90초, 시연 45초 포함] 수업 후 피드백을 기록하는 디브리핑 화면입니다. 오늘 진행한 항목과 다음에 연습할 점을 함께 남깁니다. 시연에서는 테스트용 교육생을 선택해 기존 진도를 확인하고 수업 메모를 저장합니다. 실제 고객 개인정보는 시연하지 않습니다. 네트워크가 불안정할 경우 제출한 제품 화면으로 같은 흐름을 설명합니다. 출처: 사용자 제공 화면 및 기존 코드 확인 이력.');
await slide('강사 구독을 중심으로 시작합니다',[
'초기 고객: 프리다이빙 강사와\n해당 강사의 교육생',
'가격 계획: 강사 월 3,900원\n최초 3개월 무료 이용',
'먹보야 놀자 협업 채널로 소개하고\n사용 후 의견을 받아 개선할 계획입니다.'
],null,'[50초] 처음부터 모든 스포츠를 대상으로 하기보다 대표자와 협업자가 현장을 이해하는 프리다이빙 교육에 집중합니다. 가격 계획은 강사 월 3900원이며 초기 3개월은 무료입니다. 이 가격은 계획이고 유료 전환 성과를 확보했다고 주장하지 않습니다. 먹보야 놀자 유튜브 채널과의 협업을 통한 소개를 준비하고 있으며 사용 후 의견으로 기능을 개선하려 합니다. 출처: 사용자 확인 사업모델·협업 사실.');
await slide('현장 검증 후 다른 종목으로 확장',[
'먼저 검증할 것: 수업 기록 작성 시간,\n기록 누락, 다음 수업에서의 재사용',
'교육 일정·참가자·진도·피드백의\n공통 흐름을 다른 종목에 적용 검토',
'전국체전 연계 제안: 참가자의\n훈련·사전교육 기록 관리부터 실증'
],null,'[60초] 현재는 초기 사용자 검증 단계입니다. 운영 시간 절감이나 안전사고 감소를 측정한 결과는 아직 없습니다. 실제 수업에서 기록을 남기는 시간과 누락, 다음 수업에서의 활용을 확인하려 합니다. 프리다이빙에서 검증한 뒤 종목별 교육항목을 설정하는 방식으로 확장을 검토합니다. 전국체전에서는 경기 판독이나 공식 기록을 대체하는 것이 아니라 참가자의 훈련 및 사전교육 기록을 관리하는 작은 실증을 제안합니다. 이 부분은 향후 제안이며 이미 구축한 기능이나 확보한 협약이 아닙니다.');
await slide('개발 경험과 프리다이빙 현장 경험',[
'남상현 / 럼바우 대표\n개발 14년차 · 프리다이빙 3년차 · AIDA Level 2',
'대표자 1인 개발·운영\nAIDA Instructor 협업자의 현장 의견 반영',
'AllBlue의 다음 목표\n강사가 다음 수업에도 다시 쓰는 교육 운영 도구'
],null,'[50초] 대표자는 14년차 개발자이자 프리다이빙 3년차이며 AIDA Level 2 자격을 보유하고 있습니다. 대표자 1인이 개발과 운영을 맡고 AIDA Instructor 협업자의 현장 의견을 반영합니다. 현재의 핵심은 기능 수를 늘리는 것보다 수업을 마친 강사가 다음 수업에도 이 기록을 다시 쓰도록 만드는 것입니다. 감사합니다. 출처: 사용자 확인 경력·자격·인력 구성.');
await fs.mkdir(path.join(dir,'work/render'),{recursive:true});
for(let i=0;i<p.slides.items.length;i++){const b=await p.export({slide:p.slides.items[i],format:'png',scale:1});await fs.writeFile(path.join(dir,'work/render',`slide-${i+1}.png`),new Uint8Array(await b.arrayBuffer()));}
const candidate=path.join(dir,'work/candidate.pptx');await(await PresentationFile.exportPptx(p)).save(candidate);
const result=await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath:path.join(dir,'submission/AllBlue_경기스포츠산업_발표자료.pptx'),pythonExecutable:'/Users/rumbaughnam/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit'],fontPolicy:{basis:'design',families:['SUIT']},verifyArtifactToolImport:true,receiptPath:path.join(dir,'work/validation.json')});console.log(JSON.stringify(result));
