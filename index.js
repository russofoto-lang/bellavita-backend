const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

const resend = new Resend('re_dwJgxc7x_Fbp1yE1YWxGh4K9xKgHUm7n1');

app.get('/', (req, res) => res.json({ status: 'Bella Vita Backend OK' }));

app.post('/send-ticket', async (req, res) => {
  const { booking } = req.body;
  console.log('Ricevuta richiesta per:', booking?.userEmail);

  try {
    const qrDataUrl = await QRCode.toDataURL(booking.qrCode, { width: 200 });
    const qrBase64 = qrDataUrl.replace('data:image/png;base64,', '');
    const pdfBuffer = await generateTicketPDF(booking, qrDataUrl);

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: booking.userEmail,
      subject: `🎟️ Il tuo biglietto per ${booking.eventTitle}`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background: #0D0D0D; color: #ffffff; padding: 40px; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #C9A84C; font-style: italic; margin: 0;">Bella Vita</h1>
            <p style="color: rgba(201,168,76,0.6); letter-spacing: 0.2em; font-size: 12px; margin: 4px 0 0;">EVENTI</p>
          </div>
          <h2 style="color: #ffffff; text-align: center;">Il tuo biglietto è confermato! 🎉</h2>
          <div style="background: #1A1A1A; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #C9A84C;">
            <h3 style="color: #C9A84C; margin: 0 0 16px;">${booking.eventTitle}</h3>
            <p style="margin: 8px 0; color: #ccc;">📅 ${new Date(booking.eventDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p style="margin: 8px 0; color: #ccc;">📍 ${booking.eventVenue}</p>
            <p style="margin: 8px 0; color: #ccc;">👤 ${booking.userName}</p>
            <p style="margin: 8px 0; color: #ccc;">🎟️ ${booking.quantity} bigliett${booking.quantity > 1 ? 'i' : 'o'}</p>
            <p style="margin: 8px 0; color: #ccc;">💶 €${booking.totalAmount.toFixed(2)}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #888; margin-bottom: 16px;">Il tuo QR code per l'ingresso:</p>
            <img src="cid:qrcode" alt="QR Code" style="width: 200px; height: 200px;" />
            <p style="color: #555; font-size: 12px; margin-top: 8px;">${booking.qrCode}</p>
          </div>
          <p style="color: #888; font-size: 13px; text-align: center;">
            Mostra questo QR code all'ingresso oppure apri il PDF allegato.<br/>
            Puoi anche visualizzarlo nella sezione "I miei biglietti" dell'app.
          </p>
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #333;">
            <p style="color: #555; font-size: 12px;">Bella Vita Eventi srls · P.IVA 04216850711</p>
            <a href="https://bellavitaeventi.it" style="color: #C9A84C; font-size: 12px;">bellavitaeventi.it</a>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `biglietto-${booking.eventTitle.replace(/\s+/g, '-')}.pdf`,
          content: pdfBuffer.toString('base64'),
        },
        {
          filename: 'qrcode.png',
          content: qrBase64,
          content_id: 'qrcode',
        }
      ],
    });

    console.log('Email inviata con successo a:', booking.userEmail);
    res.json({ success: true });
  } catch (error) {
    console.error('Errore:', error);
    res.status(500).json({ error: error.message });
  }
});

async function generateTicketPDF(booking, qrDataUrl) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [400, 600], margin: 30 });
    const buffers = [];

    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.rect(0, 0, 400, 600).fill('#0D0D0D');
    doc.rect(0, 0, 400, 80).fill('#1A1A1A');
    doc.fontSize(24).fillColor('#C9A84C').font('Helvetica-BoldOblique').text('Bella Vita', 30, 20);
    doc.fontSize(9).fillColor('#C9A84C').font('Helvetica').text('E V E N T I', 30, 50, { characterSpacing: 4 });
    doc.rect(0, 80, 400, 2).fill('#C9A84C');
    doc.fontSize(20).fillColor('#FFFFFF').font('Helvetica-Bold').text(booking.eventTitle, 30, 110, { width: 340 });
    doc.fontSize(11).fillColor('#C9A84C').font('Helvetica').text('DATA', 30, 160);
    doc.fontSize(12).fillColor('#FFFFFF').text(new Date(booking.eventDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }), 30, 175);
    doc.fontSize(11).fillColor('#C9A84C').text('VENUE', 30, 205);
    doc.fontSize(12).fillColor('#FFFFFF').text(booking.eventVenue, 30, 220, { width: 340 });
    doc.fontSize(11).fillColor('#C9A84C').text('INTESTATARIO', 30, 255);
    doc.fontSize(12).fillColor('#FFFFFF').text(booking.userName, 30, 270);
    doc.fontSize(11).fillColor('#C9A84C').text('BIGLIETTI', 220, 255);
    doc.fontSize(12).fillColor('#FFFFFF').text(`${booking.quantity}`, 220, 270);
    doc.rect(0, 300, 400, 1).fill('#333333');

    const qrBuffer = Buffer.from(qrDataUrl.replace('data:image/png;base64,', ''), 'base64');
    doc.image(qrBuffer, 130, 320, { width: 140, height: 140 });

    doc.fontSize(10).fillColor('#555555').text(booking.qrCode, 30, 475, { align: 'center', width: 340 });
    doc.fontSize(10).fillColor('#555555').text("Mostra questo biglietto all'ingresso", 30, 510, { align: 'center', width: 340 });
    doc.rect(0, 550, 400, 50).fill('#1A1A1A');
    doc.fontSize(9).fillColor('#555555').text('Bella Vita Eventi srls · P.IVA 04216850711 · bellavitaeventi.it', 30, 565, { align: 'center', width: 340 });

    doc.end();
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Bella Vita Backend running on port ${PORT}`));