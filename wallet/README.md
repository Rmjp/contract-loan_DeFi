# กระเป๋าเงินตัวอย่าง (wallet/)

โปรเจคนี้สร้างจาก Create React App เพื่อใช้เป็นตัวอย่างกระเป๋าเงินสำหรับจัดการ Verifiable Credential และสร้าง Proof ในการยืนยันตัวตน

## คำสั่งพื้นฐาน

- `npm start` เปิดโหมดพัฒนา
- `npm run build` สร้างไฟล์สำหรับโปรดักชัน (ใช้ติดตั้งเป็น Chrome extension)

การทดสอบในรูปแบบส่วนขยาย Chrome:
1. รัน `npm run build`
2. เปิดหน้า `chrome://extensions/` แล้วเลือก "Load unpacked" ไปที่โฟลเดอร์ `build/`

ไฟล์สำคัญอยู่ใน `src/` และสามารถแก้ไขค่า RPC ได้ใน `src/constants/common.constants`
