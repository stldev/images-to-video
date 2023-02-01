param($emailto='__none__', $emailbcc='__none__', $emailsubject='__none__', $emailbody='__none__', $emailuser='__none__', $emailpass='__none__') 

$Message = New-Object Net.Mail.MailMessage($emailuser, $emailto, $emailsubject, $emailbody)
$Message.bcc.add($emailbcc)
$Message.IsBodyHtml = $true
$SMTPClient = New-Object Net.Mail.SmtpClient("smtp.office365.com", 587)
$SMTPClient.EnableSsl = $true
$SMTPClient.Credentials = New-Object System.Net.NetworkCredential($emailuser, $emailpass);
$SMTPClient.Send($Message)
