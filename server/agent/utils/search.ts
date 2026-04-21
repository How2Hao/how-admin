import Fuse from 'fuse.js'

export function search<T>(docs: T[], keys: string[], query: string) {
  const fuse = new Fuse(docs, {
    keys,
    threshold: 0.3,
  })

  return fuse.search(query)
}
