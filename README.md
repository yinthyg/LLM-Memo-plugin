### 🧠 Auto-Memo (Chrome Extension)

Your invisible AI chat secretary. When using ChatGPT, Gemini, or DeepSeek, we often find ourselves asking the same basic questions repeatedly (e.g., "How to set 777 permissions using chmod?", "What's the command to enter a docker container?"). Auto-Memo automatically detects these repetitive queries and pops up a concise historical answer (prioritizing code blocks) in the top right corner of your page, saving you from reading through long, generated paragraphs all over again.

# ✨ Core Features

🤖 Multi-Platform Support: Perfectly compatible with ChatGPT, Gemini, and DeepSeek.

🔍 Smart Similarity Matching: Built-in lightweight text similarity algorithm (Sørensen–Dice coefficient). Even if you tweak the word order or add a few extra words, it accurately identifies if it's the same question.

✂️ Precise Code Block Extraction: Automatically filters out the AI's lengthy explanatory text, prioritizing the extraction and highlighting of Code Blocks in the response.

🪟 Native Window Interaction: The popup supports free dragging to change its position and resizing via the bottom-right corner, offering an experience just like a native desktop application.

🔒 Privacy First (100% Local Storage): Zero servers, zero telemetry. All history is saved locally on your Chrome browser's hard drive (chrome.storage.local). Your data is absolutely secure.

📋 One-Click Copy: Features a convenient "Copy Answer" button to maximize your productivity.

🚀 Installation Guide (Developer Mode)

## Since the extension is not yet published on the Chrome Web Store, please follow these steps for local installation:

Download the Project
Download or clone all the code from this repository into a local folder (e.g., named auto-memo).

Open Extensions Management Page
Type chrome://extensions/ in your Chrome browser's address bar and press Enter.

Enable Developer Mode
Find and toggle the "Developer mode" switch in the top right corner of the page.

Load the Extension
Click the "Load unpacked" button in the top left corner and select the auto-memo folder where you saved the code.

Complete Installation
You should now see "Auto-Memo" appear in your list of extensions! Simply refresh your AI chat web page for it to take effect.

## 💡 Usage Instructions

Open ChatGPT, Gemini, or DeepSeek.

Type your question normally, for example: What's the command to enter a docker container?.

Wait for the AI to finish answering (the extension will silently record the core code to your local storage in the background).

A few days later, when you run into the same issue, type something similar: how to get into docker container and hit send.

Witness the Magic: A floating window will instantly slide out in the top right corner of the page, providing you directly with the concise code recorded last time!

Click and hold the title bar of the popup to drag it around, or drag the bottom-right corner to resize the window.

🛠️ Technical Architecture & File Structure

This is a native, vanilla frontend Chrome extension built on Manifest V3:

Key Technical Breakthroughs:

Dynamic Stream Interception: Utilizes MutationObserver combined with a Debounce timer to perfectly solve the issue of failing to capture the complete DOM due to the AI's "typewriter" output effect.

Intent Recognition Algorithm: Abandons simple string comparison in favor of weighted matching by extracting English characters/command keywords, greatly improving the fault tolerance for code-related queries from developers.

# 📄 License

This project is open-sourced under the MIT License. Feel free to use, modify, and distribute it. If you find it helpful, please give it a ⭐ Star!
