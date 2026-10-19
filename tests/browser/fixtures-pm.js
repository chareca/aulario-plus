// Synthetic pages of the "Correo interno" (Messages tool of Sakai) with the same structure, ids,
// names and scripts as the real pages of MiAulario (2026-10-17). No personal data.
(function () {
  'use strict';
  const TOOL = 'https://miaulario.unavarra.es/portal/tool/T';
  const PICKER = `${TOOL}/sakai.filepicker.helper`;

  const HOME = `<!doctype html><html><head><title>Mensajes</title></head><body>
<form id="msgForum" name="msgForum" method="post" action="${TOOL}/privateMsg/pvtMsgHpView" enctype="application/x-www-form-urlencoded">
<input type="hidden" name="msgForum" value="msgForum">
<div class="navIntraTool"><a href="#" id="msgForum:composeMessage" onclick="mojarra.jsfcljs(document.getElementById('msgForum'),{'msgForum:composeMessage':'msgForum:composeMessage'},'');return false">Redactar mensaje</a> <a href="#">Nueva carpeta</a> <a href="#" id="msgForum:settings" onclick="mojarra.jsfcljs(document.getElementById('msgForum'),{'msgForum:settings':'msgForum:settings'},'');return false">Configuración</a></div>
<table><tr><td><a href="#">Recibido</a></td></tr><tr><td><a href="#">Enviado</a></td></tr></table>
<input type="hidden" name="msgForum:mainOrHp" id="msgForum:mainOrHp" value="pvtMsgHpView">
<input type="hidden" name="javax.faces.ViewState" id="j_id_jsp_178404212_0:javax.faces.ViewState:0" value="STATE-HOME">
</form></body></html>`;

  const people = (sel) => `<option value="all-participants">Todos los participantes</option>
<option value="role-instructor">Rol Instructor</option><option value="role-student">Rol Student</option>
<option value="u-me"${sel ? ' selected="selected"' : ''}>Chareca , Nicolas (chareca.1)</option>
<option value="u-2">GARCIA LOPEZ, ANA (agarcia)</option>`;

  const COMPOSE = ({ subject = '', body = '', selected = false, attached = [], labels = ['Añadir adjuntos', 'Enviar', 'Vista preliminar', 'Guardar borrador', 'Cancelar'], error = '' } = {}) => `<!doctype html><html><head><title>Correo interno</title></head><body>
<form id="compose" name="compose" method="post" action="${TOOL}/compose" enctype="application/x-www-form-urlencoded">
<input type="hidden" name="compose" value="compose">
${error ? `<div class="sak-banner-error">${error}</div>` : ''}
<p class="instruction">El asterisco (*) indica que el campo es obligatorio.</p>
<label for="compose:list1">*Para</label>
<select id="compose:list1" name="compose:list1" multiple="multiple" size="5">${people(selected)}</select>
<input id="compose:bcc_toggle" type="checkbox" name="compose:bcc_toggle" onclick="if(this.checked) { fadeInBcc(true); } else { fadeOutBcc(true); }"><label for="compose:bcc_toggle">Añadir CCO</label>
<select id="compose:list2" name="compose:list2" multiple="multiple" size="5">${people(false)}</select>
<input id="compose:send_email_out" type="checkbox" name="compose:send_email_out" checked="checked"><label for="compose:send_email_out">Enviar una copia de este mensaje a las direcciones de correo de los destinatarios</label>
<input id="compose:read_receipt" type="checkbox" name="compose:read_receipt">
<input id="compose:scheduler_send_email" type="checkbox" name="compose:scheduler_send_email">
<input id="compose:openDate" type="text" name="compose:openDate" value="">
<select id="compose:viewlist" name="compose:viewlist" size="1"><option value="3" selected="selected">Normal</option><option value="1">Baja</option><option value="5">Alta</option></select>
<label for="compose:subject">*Asunto</label><input id="compose:subject" type="text" name="compose:subject" value="${subject}">
<input type="hidden" name="ckeditor-autosave-context" id="ckeditor-autosave-context" value="messages_compose">
<textarea id="compose:pvt_message_body_inputRichText" name="compose:pvt_message_body_inputRichText">${body}</textarea>
<h4>Adjuntos</h4><input type="submit" name="compose:j_id_jsp_1863517013_94" value="${labels[0]}">
${attached.length ? `<table><tr><th>Título</th><th>Tamaño</th></tr>${attached.map((a) => `<tr><td><a href="#">${a}</a></td><td>309 KB</td></tr>`).join('')}</table>` : ''}
<input type="submit" name="compose:j_id_jsp_1863517013_121" value="${labels[1]}" class="active">
<input type="submit" name="compose:j_id_jsp_1863517013_122" value="${labels[2]}">
<input type="submit" name="compose:j_id_jsp_1863517013_123" value="${labels[3]}">
<input type="submit" name="compose:j_id_jsp_1863517013_124" value="${labels[4]}">
<input type="hidden" name="javax.faces.ViewState" id="j_id_jsp_1863517013_0:javax.faces.ViewState" value="STATE-COMPOSE">
</form></body></html>`;

  const PICKER_PAGE = (attached = []) => `<!doctype html><html><head><title>Escoja un archivo</title></head><body>
<form name="doattachitem" id="doattachitem" action="${PICKER}" method="post" enctype="multipart/form-data">
<input type="hidden" name="sakai_action" value="doAttachitem"><input type="hidden" name="itemId" id="doattachitemid" value="">
<input type="hidden" name="sakai_csrf_token" value="CSRF-1"></form>
<form name="attachForm" id="attachForm" action="${PICKER}" method="post" enctype="multipart/form-data">
<input type="hidden" name="source" value="0"><input type="hidden" name="collectionId" value="/group/S/">
<input type="hidden" name="from" value="list"><input type="hidden" name="sakai_action" value="">
<input type="hidden" name="navRoot" value=""><input type="hidden" name="criteria" value="title">
<input type="hidden" name="rt_action" value=""><input type="hidden" name="selectedItemId" value="">
<h3>Subir archivo</h3><input type="file" name="upload"><input type="text" name="url"><input type="button" name="add_url" value="Añadir">
<h3>Seleccionar un recurso</h3>
<table><tr><td><a href="#" onclick="return doattachsubmit('/group/S/Tema 1.pdf')">Adjuntar una copia</a> Tema 1.pdf</td></tr></table>
${attached.length ? `<ul class="attachList">${attached.map((a) => `<li>${a}</li>`).join('')}</ul>` : ''}
<input type="hidden" name="sakai_csrf_token" value="CSRF-1"></form>
<button type="button" id="attachButton" name="attachButton" class="active" onclick="SPNR.disableControlsAndSpin(this, null); document.getElementById('attachForm').action='${PICKER}?sakai_action=doAddattachments'; submitform('attachForm');"${attached.length ? '' : ' disabled'}>Continuar</button>
<button type="button" id="cancelButton" name="cancelButton" onclick="document.getElementById('attachForm').action='${PICKER}?sakai_action=doCancel'; submitform('attachForm');">Cancelar</button>
</body></html>`;

  // The settings page of the Messages tool (Sakai 23: jsp/privateMsg/pvtMsgSettings.jsp), as a
  // student sees it: the forward of the messages and its address (open only with "Sí").
  const SETTINGS = ({ mode = 'default', email = '', error = '' } = {}) => `<!doctype html><html><head><title>Configuración</title></head><body>
<form id="pvtMsgSettings" name="pvtMsgSettings" method="post" action="${TOOL}/privateMsg/pvtMsgSettings" enctype="application/x-www-form-urlencoded">
<input type="hidden" name="pvtMsgSettings" value="pvtMsgSettings">
<ul class="navIntraTool actionToolbar" role="menu"><li><span id="messagesMainMenuLink"><a href="#" id="pvtMsgSettings:j_id_jsp_1_3">Mensajes</a></span></li><li><span id="messagesSettingsMenuLink"><a href="#" id="pvtMsgSettings:settings">Configuración</a></span></li></ul>
<h1>Configuración</h1>
${error ? `<ul id="pvtMsgSettings:errorMessages" class="alertMessage"><li>${error}</li></ul>` : ''}
<h3>Configuración personal</h3>
<label>Reenviar mensajes automáticamente:</label>
<table id="pvtMsgSettings:fwd_msg" class="checkbox"><tr><td><input type="radio" name="pvtMsgSettings:fwd_msg" id="pvtMsgSettings:fwd_msg:0" value="yes" onchange="this.form.submit();"${mode === 'yes' ? ' checked="checked"' : ''}><label for="pvtMsgSettings:fwd_msg:0"> Sí</label></td></tr>
<tr><td><input type="radio" name="pvtMsgSettings:fwd_msg" id="pvtMsgSettings:fwd_msg:1" value="no" onchange="this.form.submit();"${mode === 'no' ? ' checked="checked"' : ''}><label for="pvtMsgSettings:fwd_msg:1"> No</label></td></tr>
<tr><td><input type="radio" name="pvtMsgSettings:fwd_msg" id="pvtMsgSettings:fwd_msg:2" value="default" onchange="this.form.submit();"${mode === 'default' ? ' checked="checked"' : ''}><label for="pvtMsgSettings:fwd_msg:2"> Por defecto</label></td></tr></table>
<label for="pvtMsgSettings:fwd_email">Dirección de correo electrónico de reenvío:</label>
<input id="pvtMsgSettings:fwd_email" type="text" name="pvtMsgSettings:fwd_email" value="${email}"${mode === 'yes' ? '' : ' disabled="disabled"'}>
<input type="submit" name="pvtMsgSettings:j_id_jsp_2_20" value="Guardar configuración" accesskey="s" class="active">
<input type="submit" name="pvtMsgSettings:j_id_jsp_2_21" value="Cancelar" accesskey="x">
<input type="hidden" name="javax.faces.ViewState" id="j_id_jsp_2_0:javax.faces.ViewState:0" value="STATE-SETTINGS">
</form></body></html>`;

  const LOGIN = '<!doctype html><html><head><title>Inicio de sesión</title></head><body><form action="/sakai-login-tool/container"><input name="eid"></form></body></html>';

  window.PM_FIXTURES = { TOOL, PICKER, HOME, COMPOSE, PICKER_PAGE, SETTINGS, LOGIN };
})();
