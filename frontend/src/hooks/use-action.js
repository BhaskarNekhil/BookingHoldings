async function busy(button, fn) {
  notice("");
  button.disabled = true;
  try {
    await fn();
  } catch (e) {
    notice(e.message);
  } finally {
    button.disabled = false;
  }
}
