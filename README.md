# 💬 2Chat - Private 1-on-1 Realtime Chat Website

Yeh ek modern, clean aur private **1-on-1 Realtime Chat Website** hai jisme 2 log ek sath real-time me chat kar sakte hain. 

Isko **Vercel** par deploy karne ke liye specially design kiya gaya hai. Isme koi backend database ya server maintain karne ki zaroorat nahi hai (WebRTC + PeerJS use karta hai jo direct browser-to-browser peer-to-peer chalta hai).

---

## ✨ Features (Kya-Kya Hai Isme?)
1. **1-Click Room Creation**: Host ek click me room banata hai aur direct invite link milta hai.
2. **Instant Link Share**: Link copy karke dost ko WhatsApp, Telegram ya kahi bhi bhej sakte hain.
3. **Direct Peer-to-Peer Encrypted**: Dono users ka browser aapas me directly connect hota hai. Server par koi chat save nahi hoti.
4. **Realtime Typing Indicator**: Jab dost type karega toh live "Typing..." dikhega.
5. **Photo / Image Sharing**: Text ke sath-sath photos bhi direct bhej sakte hain.
6. **Sound Effects**: Message aane/jaane aur connect hone par pleasant audio chimes (mute toggle bhi hai).
7. **Chat Download**: Poori chat history ko `.txt` file me 1-click me save kar sakte hain.
8. **Mobile & Desktop Responsive**: Phone aur Laptop dono me stylish Telegram/WhatsApp jaisa dark mode UI.

---

## 🚀 Vercel Par Upload / Deploy Kaise Kare? (2 Aasan Tarike)

### Tarika 1: GitHub ke Zariye (Sabse Best & Recommended)
1. Apne GitHub par jao aur ek naya repository banao (naam kuch bhi rakh sakte ho, jaise `2chat`).
2. Apne computer ke `c:\chat` folder me git initialize karke code push karo:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for 2Chat"
   git branch -M main
   git remote add origin https://github.com/<AAPKA_USERNAME>/<REPO_NAME>.git
   git push -u origin main
   ```
3. [Vercel.com](https://vercel.com) par jao aur login karo.
4. **"Add New..."** -> **"Project"** par click karo.
5. Apna GitHub repository select karo aur **"Deploy"** button par click kar do!
6. Bas! 30 seconds me aapki live link ban jayegi (jaise `https://2chat-xyz.vercel.app`).

---

### Tarika 2: Vercel CLI Se Direct (Bina GitHub ke)
1. Is folder me terminal open kare aur run kare:
   ```bash
   npx vercel
   ```
2. Terminal me Vercel login karne bolega, email daal kar verify kare.
3. Questions aayenge:
   - "Set up and deploy?" -> Press **Enter** (`Y`)
   - "Which scope?" -> Press **Enter**
   - "Link to existing project?" -> Press **N** (Enter)
   - "What's your project's name?" -> Press **Enter** (ya koi bhi naam de)
   - "In which directory is your code located?" -> Press **Enter** (`./`)
4. 1 minute me Vercel aapko direct **Production Live Link** de dega!

---

## 💻 Apne Computer Par Test Kaise Kare?
Agar Vercel par daalne se pehle abhi apne computer par test karna chahte ho:

```bash
npx serve .
```
Terminal me link aayegi (jaise `http://localhost:3000`).
- Ek tab me open karo -> Apna naam dalo -> "Create New Chat Room" par click karo.
- Jo share link aayegi usko dusre browser tab (ya incognito window) me open karo.
- Dono aapas me instantly chat kar payenge!

---

## 📁 File Structure
- `index.html` - Poora UI structure, dark mode theme aur responsive layout.
- `style.css` - Custom animations, glassmorphism aur scroll styling.
- `app.js` - Realtime WebRTC connection, typing indicator, image sharing aur sound effects.
- `vercel.json` - Vercel optimization configuration.
- `package.json` - Local testing scripts.
