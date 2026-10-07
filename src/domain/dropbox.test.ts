import { dropboxBackupDue, isDropboxConnection, parseAuthReturn } from './dropbox'

describe('dropboxBackupDue (FR-78)', () => {
  it('is due when none was made, or the last one was on an earlier day', () => {
    expect(dropboxBackupDue(null, '2026-10-07')).toBe(true)
    expect(dropboxBackupDue('2026-10-06T23:59:00.000Z', '2026-10-08')).toBe(true)
  })

  it('is not due again the same day', () => {
    const now = new Date(2026, 9, 7, 9, 0).toISOString()
    expect(dropboxBackupDue(now, '2026-10-07')).toBe(false)
  })
})

describe('parseAuthReturn', () => {
  it('finds nothing in an ordinary address', () => {
    expect(parseAuthReturn('', 'abc')).toEqual({ kind: 'none' })
    expect(parseAuthReturn('?tab=1', null)).toEqual({ kind: 'none' })
  })

  it('takes the code when the state is the one saved before leaving', () => {
    expect(parseAuthReturn('?code=xyz&state=abc', 'abc')).toEqual({ kind: 'code', code: 'xyz' })
  })

  it('ignores a return that did not start here (different or no saved state)', () => {
    expect(parseAuthReturn('?code=xyz&state=other', 'abc')).toEqual({ kind: 'mismatch' })
    expect(parseAuthReturn('?code=xyz&state=abc', null)).toEqual({ kind: 'mismatch' })
    expect(parseAuthReturn('?code=xyz', 'abc')).toEqual({ kind: 'mismatch' })
  })

  it('reports a refusal at Dropbox', () => {
    expect(parseAuthReturn('?error=access_denied&state=abc', 'abc')).toEqual({ kind: 'denied' })
  })
})

describe('isDropboxConnection', () => {
  const good = {
    refreshToken: 'r',
    accessToken: 'a',
    expiresAt: '2026-10-07T00:00:00.000Z',
    lastBackupAt: null,
    needsChoice: false,
    signedOut: false,
    lastError: null,
  }
  it('accepts a whole record and rejects anything else', () => {
    expect(isDropboxConnection(good)).toBe(true)
    expect(isDropboxConnection({ ...good, signedOut: undefined })).toBe(false)
    expect(isDropboxConnection(null)).toBe(false)
    expect(isDropboxConnection('x')).toBe(false)
  })
})
