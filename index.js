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
    const qrDataUrl = await QRCode.toDataURL(booking.qrCode, { width: 250, margin: 2 });
    const qrBase64 = qrDataUrl.replace('data:image/png;base64,', '');
    const pdfBuffer = await generateTicketPDF(booking, qrDataUrl);

    const expiryDate = new Date(booking.expiresAt).toLocaleDateString('it-IT', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    await resend.emails.send({
      from: 'noreply@bellavitaeventi.it',
      to: booking.userEmail,
      subject: `🎟️ Prenotazione confermata — ${booking.eventTitle}`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
          
          <div style="background: #0D0D0D; padding: 28px 32px; text-align: center;">
            <span style="font-style: italic; font-size: 22px; color: #C9A84C;">Bella Vita</span>
            <span style="font-size: 11px; letter-spacing: 0.2em; color: rgba(201,168,76,0.6); margin-left: 6px;">EVENTI</span>
          </div>

          <div style="padding: 32px;">
            <h2 style="color: #0D0D0D; margin: 0 0 8px; font-size: 22px;">Prenotazione confermata! 🎉</h2>
            <p style="color: #6b7280; margin: 0 0 24px; font-size: 14px;">Ciao <strong>${booking.userName}</strong>, il tuo posto è riservato.</p>

            <div style="background: #f9fafb; border-radius: 10px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #C9A84C;">
              <h3 style="color: #C9A84C; margin: 0 0 12px; font-size: 16px;">${booking.eventTitle}</h3>
              <p style="margin: 6px 0; color: #374151; font-size: 14px;">📅 ${new Date(booking.eventDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p style="margin: 6px 0; color: #374151; font-size: 14px;">📍 ${booking.eventVenue}</p>
              <p style="margin: 6px 0; color: #374151; font-size: 14px;">👤 ${booking.userName}</p>
              <p style="margin: 6px 0; color: #374151; font-size: 14px;">🎟️ ${booking.quantity} posto/i prenotato/i</p>
              <p style="margin: 6px 0; color: #374151; font-size: 14px;">💶 Totale: €${booking.totalAmount.toFixed(2)}</p>
            </div>

            <div style="background: #fff7ed; border-radius: 10px; padding: 20px; margin-bottom: 24px; border: 1px solid #fed7aa;">
              <h3 style="color: #c2410c; margin: 0 0 10px; font-size: 15px;">📋 Come ritirare il biglietto</h3>
              <p style="margin: 0 0 8px; color: #374151; font-size: 14px;">Presenta il QR code allegato in biglietteria entro il <strong>${expiryDate}</strong>.</p>
              ${booking.eventTicketOfficeAddress ? `<p style="margin: 6px 0; color: #374151; font-size: 14px;">📍 <strong>${booking.eventTicketOfficeAddress}</strong></p>` : ''}
              ${booking.eventWhatsapp ? `<p style="margin: 6px 0; color: #374151; font-size: 14px;">💬 Per info WhatsApp: <strong>${booking.eventWhatsapp}</strong></p>` : ''}
              <p style="margin: 8px 0 0; color: #dc2626; font-size: 13px; font-weight: bold;">⚠️ La prenotazione scade il ${expiryDate}. Dopo questa data il posto viene liberato automaticamente.</p>
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
              <p style="color: #6b7280; font-size: 13px; margin-bottom: 12px;">Il tuo QR code di prenotazione:</p>
              <img src="cid:qrcode" alt="QR Code" style="width: 180px; height: 180px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px;" />
              <p style="color: #9ca3af; font-size: 11px; margin-top: 8px; font-family: monospace;">${booking.qrCode}</p>
            </div>

            <p style="color: #6b7280; font-size: 13px; text-align: center;">
              Trovi il QR anche nella sezione <strong>"Le mie prenotazioni"</strong> dell'app.
            </p>
          </div>

          <div style="background: #f9fafb; padding: 16px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">Bella Vita Eventi srls · P.IVA 04216850711</p>
            <a href="https://bellavitaeventi.it" style="color: #C9A84C; font-size: 12px;">bellavitaeventi.it</a>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `prenotazione-${booking.eventTitle.replace(/\s+/g, '-')}.pdf`,
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
    const doc = new PDFDocument({ size: [400, 620], margin: 0 });
    const buffers = [];

    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Sfondo bianco
    doc.rect(0, 0, 400, 620).fill('#FFFFFF');

    // Header dorato
    doc.rect(0, 0, 400, 70).fill('#C9A84C');
    doc.fontSize(22).fillColor('#FFFFFF').font('Helvetica-BoldOblique').text('Bella Vita', 24, 16);
    doc.fontSize(8).fillColor('rgba(255,255,255,0.8)').font('Helvetica').text('E V E N T I', 24, 44, { characterSpacing: 3 });
    doc.fontSize(9).fillColor('#FFFFFF').font('Helvetica').text('PRENOTAZIONE', 0, 28, { align: 'right', width: 376 });

    // Titolo evento
    doc.rect(0, 70, 400, 2).fill('#E8C97A');
    doc.fontSize(18).fillColor('#0D0D0D').font('Helvetica-Bold').text(booking.eventTitle, 24, 88, { width: 352 });

    // Artista se presente
    let yPos = 88 + (booking.eventTitle.length > 30 ? 50 : 30);

    // Sezione dettagli evento
    doc.rect(24, yPos, 352, 1).fill('#E5E7EB');
    yPos += 14;

    const details = [
      { label: 'DATA', value: new Date(booking.eventDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) },
      { label: 'LUOGO', value: booking.eventVenue },
      { label: 'INTESTATARIO', value: `${booking.userName}` },
      { label: 'POSTI', value: `${booking.quantity}` },
      { label: 'IMPORTO', value: `€${booking.totalAmount.toFixed(2)}` },
    ];

    details.forEach(d => {
      doc.fontSize(8).fillColor('#9CA3AF').font('Helvetica').text(d.label, 24, yPos, { characterSpacing: 1 });
      doc.fontSize(11).fillColor('#1F2937').font('Helvetica').text(d.value, 24, yPos + 11, { width: 352 });
      yPos += 38;
    });

    // Linea tratteggiata separatrice
    yPos += 4;
    doc.rect(24, yPos, 352, 1).fill('#E5E7EB');

    // Info ritiro
    yPos += 14;
    doc.rect(24, yPos, 352, booking.eventTicketOfficeAddress ? 56 : 38).fill('#FFF7ED').stroke('#FED7AA');
    doc.fontSize(8).fillColor('#C2410C').font('Helvetica-Bold').text('DOVE RITIRARE IL BIGLIETTO', 34, yPos + 8, { characterSpacing: 1 });
    if (booking.eventTicketOfficeAddress) {
      doc.fontSize(10).fillColor('#374151').font('Helvetica').text(booking.eventTicketOfficeAddress, 34, yPos + 20, { width: 332 });
      yPos += 56;
    } else {
      yPos += 38;
    }

    // Scadenza
    yPos += 8;
    const expiryDate = new Date(booking.expiresAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.fontSize(9).fillColor('#DC2626').font('Helvetica-Bold').text(`⚠ Ritirare entro il ${expiryDate}`, 24, yPos, { width: 352, align: 'center' });

    // QR Code centrato
    yPos += 20;
    const qrBuffer = Buffer.from(qrDataUrl.replace('data:image/png;base64,', ''), 'base64');
    const qrSize = 130;
    const qrX = (400 - qrSize) / 2;
    doc.image(qrBuffer, qrX, yPos, { width: qrSize, height: qrSize });

    // Codice QR sotto
    yPos += qrSize + 8;
    doc.fontSize(8).fillColor('#9CA3AF').font('Helvetica').text(booking.qrCode, 0, yPos, { align: 'center', width: 400 });

    // Footer
    const footerY = 590;
    doc.rect(0, footerY, 400, 30).fill('#F9FAFB');
    doc.rect(0, footerY, 400, 1).fill('#E5E7EB');
    doc.fontSize(8).fillColor('#9CA3AF').font('Helvetica').text('Bella Vita Eventi srls · P.IVA 04216850711 · bellavitaeventi.it', 0, footerY + 10, { align: 'center', width: 400 });

    doc.end();
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Bella Vita Backend running on port ${PORT}`));
