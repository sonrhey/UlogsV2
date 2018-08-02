export function getEditorUrl(tags) {
    let editorUrl = 'editor';
    if (tags) {
      if (tags.length === 1 && tags[0] === "ulog") {
        editorUrl = 'main-editor';
      } else if (tags.length > 1 && tags[0] === "ulog") {
        if (tags[1] === "ulog-ned") {
          editorUrl = 'ulog-ned';
        } else {
          editorUrl = 'main-editor';
        }
      }
    }
    return editorUrl;
}
