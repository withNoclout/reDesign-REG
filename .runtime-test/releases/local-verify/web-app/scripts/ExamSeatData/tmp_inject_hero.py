import re

file_path = 'ICIT_Wifi_Analysis/manager_dashboard.html'
with open(file_path, 'r', encoding='utf-8') as f:
    html = f.read()

# The new Hero Section HTML to replace the old one
new_hero_html = """
<header class="container" style="position: relative; overflow: hidden;">
    <!-- Background Decorators -->
    <div style="position: absolute; top: -10%; left: -10%; width: 50vh; height: 50vh; background: radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%); border-radius: 50%; filter: blur(60px); z-index: -1;"></div>
    <div style="position: absolute; bottom: -10%; right: -10%; width: 50vh; height: 50vh; background: radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%); border-radius: 50%; filter: blur(60px); z-index: -1;"></div>

    <div class="fade-up" style="position: relative; z-index: 1;">
        <div class="hero-badge" style="background: rgba(139, 92, 246, 0.15); border-color: rgba(139, 92, 246, 0.4); color: #c4b5fd; text-transform: uppercase; letter-spacing: 1px; font-size: 0.85rem;">Executive Summary Dashboard</div>
        <h1 style="font-size: 3.5rem; letter-spacing: -1px; margin-bottom: 1.5rem;">ยกระดับประสบการณ์ Wi-Fi <br><span style="color: #fff; background: none; -webkit-text-fill-color: initial;">ด้วยความลับจากข้อมูลเชิงลึก</span></h1>
        <p style="max-width: 900px; margin: 0 auto; font-size: 1.25rem; color: #94a3b8; line-height: 1.8;">
            สรุปผลการวิเคราะห์เจาะลึก <b>189,445 Sessions</b> สู่แผนปฏิบัติการที่ครอบคลุม 12 อาคาร ทั่ววิทยาเขต 
            พบกุญแจสำคัญในการปลดล็อกศักยภาพคลื่นความถี่และขจัดทรัพยากรสูญเปล่า โดยไม่ต้องจัดสรรงบประมาณจัดซื้อ Access Point เพิ่ม
        </p>
    </div>

    <!-- New Executive KPI Scoreboards -->
    <div class="metrics-grid fade-up" style="transition-delay: 0.2s; margin-top: 3.5rem; display: grid; grid-template-columns: repeat(12, 1fr); gap: 20px; align-items: stretch; position: relative; z-index: 1;">
        
        <!-- Primary KPI (Mandatory) spans 6 cols -->
        <div class="metric-card" style="grid-column: span 12; background: linear-gradient(145deg, rgba(20,25,35,0.9), rgba(15,20,30,0.95)); border: 1px solid rgba(139, 92, 246, 0.4); box-shadow: 0 10px 40px rgba(139, 92, 246, 0.1);">
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <h3 style="color: #cbd5e1; font-weight: 500; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 1px;">ระบบมีเสถียรภาพและรับส่งข้อมูลดีขึ้นรวม (Total Improvement)</h3>
                <div style="font-size: 4.5rem; font-weight: 700; margin: 5px 0; background: -webkit-linear-gradient(45deg, #60a5fa, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                    +<span class="count-up" data-target="60" data-suffix="%">0%</span>
                </div>
                <p style="color: #64748b; font-size: 0.95rem; margin: 0;">ประเมินผลลัพธ์สุทธิจากการเปิด Band Steering (30%) และเคลียร์ Zombie Sessions (28%)</p>
            </div>
        </div>

        <!-- 3 Supporting KPIs spans 4 cols each -->
        <div class="metric-card" style="grid-column: span 4; display: flex; flex-direction: column; justify-content: flex-start; border-top: 3px solid var(--success);">
            <div style="font-size: 1.5rem; margin-bottom: 15px;">🔄</div>
            <h3 style="font-size: 1rem; color: #94a3b8; font-weight: 500; min-height: 48px;">ความจุระบบที่ดึงกลับมาได้<br>(Capacity Recovered)</h3>
            <div class="metric-value success" style="font-size: 2.5rem;"><span class="count-up" data-target="53" data-suffix="k">0k</span></div>
            <p style="font-size: 0.85rem; line-height: 1.4; margin-top: auto; padding-top: 15px;">Sessions ว่างเปล่าที่ถูกกำจัดทิ้ง เตรียมพร้อมให้ผู้ใช้งานจริง</p>
        </div>

        <div class="metric-card" style="grid-column: span 4; display: flex; flex-direction: column; justify-content: flex-start; border-top: 3px solid var(--accent-blue);">
            <div style="font-size: 1.5rem; margin-bottom: 15px;">🚀</div>
            <h3 style="font-size: 1rem; color: #94a3b8; font-weight: 500; min-height: 48px;">ปริมาณแบนด์วิดท์เฉลี่ย<br>(Avg. Bandwidth Uplift)</h3>
            <div class="metric-value accent" style="font-size: 2.5rem; color: #60a5fa !important;">+<span class="count-up" data-target="26" data-suffix="%">0%</span></div>
            <p style="font-size: 0.85rem; line-height: 1.4; margin-top: auto; padding-top: 15px;">ความเร็วเพิ่มขึ้นต่อคน หลังลดความแออัดบนคลื่น 5GHz</p>
        </div>

        <div class="metric-card" style="grid-column: span 4; display: flex; flex-direction: column; justify-content: flex-start; border-top: 3px solid var(--warning);">
            <div style="font-size: 1.5rem; margin-bottom: 15px;">💰</div>
            <h3 style="font-size: 1rem; color: #94a3b8; font-weight: 500; min-height: 48px;">การประหยัดงบลงทุน<br>(Virtual Expansion Output)</h3>
            <div class="metric-value warning" style="font-size: 2.5rem;"><span class="count-up" data-target="150" data-prefix="~" data-suffix=" APs">0 APs</span></div>
            <p style="font-size: 0.85rem; line-height: 1.4; margin-top: auto; padding-top: 15px;">ผลลัพธ์เทียบเท่าการจัดซื้อและติดตั้ง Access Point ชุดใหม่ระบบ</p>
        </div>

    </div>
</header>
"""

# Find the existing header block and replace it
header_pattern = re.compile(r'<header class="container">.*?</header>', re.DOTALL)
if header_pattern.search(html):
    html = header_pattern.sub(new_hero_html, html)
    print("Successfully replaced the Hero <header> section.")
else:
    print("Could not find the expected <header> section.")

# Add the JavaScript logic for the Count-up animation
# We will inject it right before the closing </body> tag or inside the existing script block
countup_script = """
        // --- Number Count-Up Animation for Hero Section ---
        const animateValue = (obj, start, end, duration, prefix, suffix) => {
            let startTimestamp = null;
            const step = (timestamp) => {
                if (!startTimestamp) startTimestamp = timestamp;
                const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                // Easing function: easeOutQuart
                const easeProgress = 1 - Math.pow(1 - progress, 4);
                let current = Math.floor(easeProgress * (end - start) + start);
                obj.innerHTML = (prefix || '') + current + (suffix || '');
                if (progress < 1) {
                    window.requestAnimationFrame(step);
                } else {
                    obj.innerHTML = (prefix || '') + end + (suffix || ''); // Ensure final value is exact
                }
            };
            window.requestAnimationFrame(step);
        };

        const counterObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const targetStr = entry.target.getAttribute('data-target');
                    if (targetStr && !entry.target.classList.contains('counted')) {
                        const target = parseInt(targetStr, 10);
                        const prefix = entry.target.getAttribute('data-prefix') || '';
                        const suffix = entry.target.getAttribute('data-suffix') || '';
                        animateValue(entry.target, 0, target, 2000, prefix, suffix);
                        entry.target.classList.add('counted');
                    }
                }
            });
        }, { threshold: 0.5 });

        document.querySelectorAll('.count-up').forEach(el => counterObserver.observe(el));
"""

# Replace `// --- Chart.js Configurations ---` with the combined scripts to ensure it is in the active script block
if 'Chart.defaults.color' in html:
    html = html.replace("// --- Chart.js Configurations ---", countup_script + "\n        // --- Chart.js Configurations ---")
    print("Successfully injected Number Count-Up animation script.")
else:
    print("Could not find script injection target. Appending to body.")
    html = html.replace("</body>", "<script>\n" + countup_script + "\n</script>\n</body>")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Hero section redesign implemented.")
