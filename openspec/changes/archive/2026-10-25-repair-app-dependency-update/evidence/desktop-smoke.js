(async()=>{
const wait=async predicate=>{for(let i=0;i<50;i++){if(predicate())return;await new Promise(r=>setTimeout(r,100));}throw new Error('UI condition timed out');};
const clickConversation=n=>{const target=[...document.querySelectorAll('.conversation-target')].find(e=>e.textContent.includes('依赖升级离线验收 '+n));if(!target)throw new Error('Fixture conversation absent');target.click();};
const result={userAgent:navigator.userAgent};
const home=()=>[...document.querySelectorAll('button')].find(e=>e.innerText.trim()==='新对话');
home().click();await wait(()=>document.body.innerText.includes('想法，从这里展开。'));
clickConversation(1);await wait(()=>document.querySelector('.message-list')?.innerText.includes('离线验收 1 / 消息 80'));
let scroller=document.querySelector('.message-list');result.first={scrollHeight:scroller.scrollHeight,clientHeight:scroller.clientHeight,scrollTop:scroller.scrollTop};
if(scroller.scrollHeight<=scroller.clientHeight)throw new Error('Expected scrollable message history');
scroller.scrollTop=0;scroller.dispatchEvent(new Event('scroll'));await new Promise(r=>setTimeout(r,250));result.scrollTop=scroller.scrollTop;if(scroller.scrollTop!==0)throw new Error('Scroll to top failed');
clickConversation(2);await wait(()=>document.querySelector('.message-list')?.innerText.includes('离线验收 2 / 消息 1'));
scroller=document.querySelector('.message-list');result.switchPosition=scroller.scrollTop;
for(let i=0;i<10;i++){scroller.scrollTop=scroller.scrollHeight;scroller.dispatchEvent(new Event('scroll'));await new Promise(r=>setTimeout(r,150));if(scroller.innerText.includes('离线验收 2 / 消息 80'))break;}
if(!scroller.innerText.includes('离线验收 2 / 消息 80'))throw new Error('Manual scroll to final message failed');result.switchConversation=true;result.manualScrollToEnd=true;
const theme=document.querySelector('button[aria-label="深色主题"]');if(!theme)throw new Error('Theme control absent');theme.click();await new Promise(r=>setTimeout(r,250));result.theme=await window.api.getThemeMode();if(result.theme!=='dark')throw new Error('Theme IPC persistence failed');
const fresh=[...document.querySelectorAll('button')].find(e=>e.innerText.trim()==='新对话');fresh.click();await wait(()=>document.body.innerText.includes('想法，从这里展开。'));result.newConversationRoute=true;
clickConversation(1);await wait(()=>document.querySelector('.message-list')?.innerText.includes('离线验收 1 / 消息 80'));
result.platform=window.api.platform();result.windowMaximized=await window.api.isWindowMaximized();result.mainLoaded=true;result.modelCalls=0;
return result;
})()
