const nodemailer = require('nodemailer');
const Item = require('../models/Item');
const User = require('../models/User');

exports.contactReporter = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { details, sharePhone } = req.body;
    const senderId = req.user.id;

    // Fetch the item to get reporter details
    const item = await Item.findById(itemId).populate('reporterId');
    if (!item) return res.status(404).json({ message: 'Item not found' });

    const reporter = item.reporterId;
    
    // Fetch the sender details
    const sender = await User.findById(senderId);

    // Ensure reporter has an email
    if (!reporter || !reporter.email) {
      return res.status(400).json({ message: 'Reporter email not found' });
    }

    // Configure Nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Construct the email content
    const action = item.type === 'lost' ? 'found' : 'claimed';
    const Action = item.type === 'lost' ? 'Found' : 'Claimed';

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: reporter.email,
      replyTo: sender.email,
      subject: `[RU Lost & Found] Item ${Action}: ${item.title}`,
      html: `
        <h3>Hello ${reporter.firstName},</h3>
        <p>Good news! A student has ${action} the item you posted: <strong>${item.title}</strong>.</p>
        <hr/>
        <h4>Their Details:</h4>
        <ul>
          <li><strong>Name:</strong> ${sender.firstName} ${sender.lastName}</li>
          <li><strong>Email:</strong> ${sender.email}</li>
          ${sharePhone && sender.phone ? `<li><strong>Phone:</strong> ${sender.phone}</li>` : ''}
          <li><strong>School:</strong> ${sender.school}</li>
          <li><strong>Year:</strong> ${sender.year}</li>
          <li><strong>Enrollment Number:</strong> ${sender.enrollmentNumber}</li>
        </ul>
        ${details ? `<h4>Additional Details Provided:</h4><p>${details}</p>` : ''}
        <br/>
        <p>Please reply directly to their email (${sender.email}) to coordinate.</p>
        <br/>
        <p>Best regards,<br/>RU Lost & Found Team</p>
      `
    };

    // Send email
    await transporter.sendMail(mailOptions);

    // Immediately update the item's status to claimed
    item.status = 'claimed';
    item.claimedBy = {
      name: `${sender.firstName} ${sender.lastName}`,
      contact: sender.email,
      details: details || ''
    };
    await item.save();

    res.json({ message: 'Email sent successfully and item status updated' });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ message: 'Server error while sending email', error: error.message });
  }
};
