/* Segregated list structure allows us to avoid using an extra pointer for tracking context
   
   Before: Parent -- r1 -- r2 -- r3   red children are standalone, contextual nodes.
             |                        black children are real children.
             b1 -- b2 -- b3           this scheme req a firstBlackChild and firstRedChild pointer.

   After:                  Parent             we segregate the black children from the red children.
                             |                this way, we only require a single pointer.
           r3 -- r2 -- r1 -- b1 -- b2 -- b3   
   
   We don't implement a new class here, instead we write methods which act on children objects.
   These methods allow adding (linking) and removing (unlinking) colored children nodes from a parent,
   such that the structure remains consistent.

   Every node is a parent who has segregated children nodes.
   Every node is a segregated child, except for top-level nodes. */

// abstract common ops
const linkAfter = (f, s, n=s.sib) =>
  (((f.prev = s).sib = f).sib = n) && (n.prev = f);
const linkBefore = (f, s, n=s.prev) =>
  (((f.sib = s).prev = f).prev = n) && (n.sib = f);

// attach node f into seg-list p after sibling s
const link = (f, p, s=null) => {
  // short the highest probability case
  if (f.root < 2 && s) return linkAfter(f, s);
  if (s = p.next) (s.root < 2 ? linkBefore : linkAfter)(f, s);
  if (f.root < 2 || !s || s.root > 1) p.next = f;
}
// detach node f from seg-list p after sibling s
const unlink = (f, p, s=null, n=f.sib) => {
  if (n) n.prev = s;
  if (s) s.sib = n;
  if (f === p.next) p.next = n || s
}

module.exports = { link, unlink }
