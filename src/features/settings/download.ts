/** Hands a text file to the browser as a download. Nothing is sent anywhere. */
export function downloadTextFile(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // Give the browser a moment to start the download before letting the file go.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
