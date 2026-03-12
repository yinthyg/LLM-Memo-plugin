console.log("🚀 Auto-Memo 插件已成功注入页面！");

// ==========================================
// 1. 核心状态与配置
// ==========================================
const SIMILARITY_THRESHOLD = 0.55; // 相似度阈值 (0 到 1)，0.55 对于短句比较合适
let pendingQuestionId = null;      // 记录当前正在等待 AI 回答的问题 ID
let domObserver = null;            // 监听 DOM 变化的观察者
let typingTimer = null;            // 用于判断 AI 是否停止输出的定时器

// ==========================================
// 2. 文本相似度算法 (Sørensen–Dice 系数)
// 作用：判断 "怎么进容器" 和 "如何进入容器" 是否是同一个问题
// ==========================================
function getSimilarity(str1, str2) {
    // 核心改进：提取英文/数字关键字（如 chmod, 777, docker），对程序员来说这才是核心意图
    const getKeywords = (s) => s.toLowerCase().match(/[a-z0-9_]+/g) || [];
    const kw1 = getKeywords(str1);
    const kw2 = getKeywords(str2);

    let kwScore = 0;
    if (kw1.length > 0 || kw2.length > 0) {
        let intersection = kw1.filter(k => kw2.includes(k)).length;
        kwScore = (2.0 * intersection) / (kw1.length + kw2.length);
    }

    // 剔除常见的中文废话后比对
    const cleanStr = (s) => s.replace(/[怎么|如何|什么|的|了|呢|啊|请|帮我|告诉|写]/g, '').replace(/\s+/g, '');
    const c1 = new Set(cleanStr(str1).split(''));
    const c2 = new Set(cleanStr(str2).split(''));
    let cScore = 0;
    if (c1.size + c2.size > 0) {
        let cIntersection = 0;
        for (let char of c1) { if (c2.has(char)) cIntersection++; }
        cScore = (2.0 * cIntersection) / (c1.size + c2.size);
    }

    // 如果句子包含英文命令，英文匹配的权重占 70%，中文占 30%
    if (kw1.length > 0 && kw2.length > 0) {
        return (kwScore * 0.7) + (cScore * 0.3);
    }
    return cScore;
}

// ==========================================
// 3. 数据库操作 (封装 Chrome 本地存储)
// ==========================================
async function getMemos() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['ai_memos'], function(result) {
            resolve(result.ai_memos || []);
        });
    });
}

async function saveMemos(memos) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ 'ai_memos': memos }, resolve);
    });
}

// ==========================================
// 4. 监听用户提问 (回车键拦截)
// ==========================================
document.addEventListener('keydown', async (e) => {
    // 检查是否按下 Enter 键，并且没有按 Shift 键（Shift+Enter 是换行）
    if (e.key === 'Enter' && !e.shiftKey) {
        const target = e.target;
        // 判断当前焦点是不是输入框
        if (target.tagName === 'TEXTAREA' || target.isContentEditable) {
            const text = target.tagName === 'TEXTAREA' ? target.value : target.innerText;
            const question = text.trim();
            
            if (question.length > 3) { // 忽略太短的无意义提问，比如 "你好"
                await handleUserQuestion(question);
            }
        }
    }
}, true); // 使用捕获阶段，确保比网页自带的发送逻辑先执行

// 处理提问逻辑
async function handleUserQuestion(question) {
    let memos = await getMemos();
    
    // 寻找是否有相似的问题
    let matchedMemo = memos.find(m => getSimilarity(m.question, question) >= SIMILARITY_THRESHOLD);

    if (matchedMemo) {
        console.log("🔍 发现重复问题！相似度达标");
        matchedMemo.count += 1;
        matchedMemo.lastAsked = Date.now();
        await saveMemos(memos);

        // 如果重复次数 >= 2，且已经有记录的答案，就弹窗提示！
        if (matchedMemo.count >= 2 && matchedMemo.answer) {
            showMemoPopup(matchedMemo.question, matchedMemo.answer);
        } else if (!matchedMemo.answer) {
            // 如果之前问过，但没抓取到答案，这次重新抓取
            pendingQuestionId = matchedMemo.id;
            startWatchingForAnswer();
        }
    } else {
        console.log("📝 这是一个新问题，记录到小本本");
        const newMemo = {
            id: Date.now().toString(),
            question: question,
            answer: "",
            count: 1,
            lastAsked: Date.now()
        };
        memos.push(newMemo);
        await saveMemos(memos);
        
        // 标记这个新问题，等待抓取 AI 的回答
        pendingQuestionId = newMemo.id;
        startWatchingForAnswer();
    }
}

// ==========================================
// 5. 抓取 AI 回答 (智能等待 DOM 稳定)
// ==========================================
function startWatchingForAnswer() {
    if (domObserver) domObserver.disconnect();

    // 观察网页的变化
    domObserver = new MutationObserver(() => {
        // 每次网页内容变化，都重新计时。
        // 如果 3 秒内网页不再变化，说明 AI 已经“回答完毕”
        clearTimeout(typingTimer);
        typingTimer = setTimeout(extractAndSaveAnswer, 3000);
    });

    domObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
}

async function extractAndSaveAnswer() {
    if (!pendingQuestionId) return;

    let answerText = "";
    let answerDom = null;
    
    // 兼容 ChatGPT 的 DOM 结构
    const chatgptResponses = document.querySelectorAll('.markdown, [data-message-author-role="assistant"]');
    // 兼容 Gemini 的 DOM 结构
    const geminiResponses = document.querySelectorAll('message-content, .model-response-text, .response-container');
    // 兼容 DeepSeek 的 DOM 结构
    const deepseekResponses = document.querySelectorAll('.ds-markdown, .markdown-body, [class*="message-content"], [class*="markdown"]');

    if (chatgptResponses.length > 0) {
        answerDom = chatgptResponses[chatgptResponses.length - 1];
    } else if (geminiResponses.length > 0) {
        answerDom = geminiResponses[geminiResponses.length - 1];
    } else if (deepseekResponses.length > 0) {
        answerDom = deepseekResponses[deepseekResponses.length - 1];
    }

    if (answerDom) {
        // 核心改进：优先提取代码块 (pre code) 而不是长篇大论，同时兼容 DeepSeek 的代码块类名
        const codeBlocks = answerDom.querySelectorAll('pre code, .code-block, .md-code-block');
        
        if (codeBlocks.length > 0) {
            // 如果 AI 写了代码块，直接抓取第一段代码
            answerText = codeBlocks[0].innerText.trim();
        } else {
            // 如果没有代码块，尽量只提取第一句话
            const firstParagraph = answerDom.querySelector('p');
            answerText = firstParagraph ? firstParagraph.innerText.trim() : answerDom.innerText.trim();
            // 如果还是很长，就截断它
            if (answerText.length > 150) {
                answerText = answerText.substring(0, 150) + "\n... (内容较长，已过滤)";
            }
        }
    }

    if (answerText && answerText.trim().length > 0) {
        console.log("✅ 成功抓取精简版 AI 回答，保存至备忘录！");
        
        // 保存答案到对应的备忘录
        let memos = await getMemos();
        const memoIndex = memos.findIndex(m => m.id === pendingQuestionId);
        if (memoIndex !== -1) {
            memos[memoIndex].answer = answerText;
            await saveMemos(memos);
            console.log("💾 答案已保存到本地存储");
        }
        
        // 重置监听状态
        pendingQuestionId = null;
        if (domObserver) {
            domObserver.disconnect();
            domObserver = null;
        }
    }
}

// ==========================================
// 6. 弹窗显示
// ==========================================
function showMemoPopup(question, answer) {
    // 如果已经有弹窗了，先删掉
    const existingBox = document.getElementById('auto-memo-popup');
    if (existingBox) existingBox.remove();

    // 创建弹窗容器
    const popup = document.createElement('div');
    popup.id = 'auto-memo-popup';
    
    // 弹窗 HTML 结构
    popup.innerHTML = `
        <div class="memo-header">
            <span>💡 嘿！你之前问过这个问题：</span>
            <button id="memo-close-btn">&times;</button>
        </div>
        <div class="memo-question">"${question}"</div>
        <div class="memo-answer-title">上次的答案是：</div>
        <div class="memo-answer">${answer}</div>
        <button id="memo-copy-btn">复制答案</button>
    `;

    document.body.appendChild(popup);

    // 绑定关闭按钮事件
    document.getElementById('memo-close-btn').addEventListener('click', () => {
        popup.remove();
    });

    // 绑定复制按钮事件
    document.getElementById('memo-copy-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(answer).then(() => {
            const copyBtn = document.getElementById('memo-copy-btn');
            copyBtn.innerText = "已复制 ✓";
            copyBtn.style.background = "#10b981";
            setTimeout(() => { popup.remove(); }, 1500);
        });
    });
}