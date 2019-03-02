// root = 0, 1 or 2
// path = -2, -1, 0, or 1+
// evt.path = -1 or 0
// aff count = 0+

//                                step count       state
//                      --------------C------------|-S-|
//                      00000000000000000000000000000001    isChild       1  // these flags waste
//                      00000000000000000000000000000010    isContextual  2  // entropy 
//                      00000000000000000000000000000100    hasEvent      4  // total entropy = 5 bits
//                      00000000000000000000000000001000    isUnmounted   8
//                      00000000000000000000000000010000    inPath        16
// 00000000000000000000000000000000000000000000000000000


// root 3 states
// path -2 

// removing x root type                 = 1 x 3 +
// in path x root type x has event      = 2 x 3 x 2
//                                      = 3 + 12 = 15

// states:
// removed, child
// removed, root
// removed, context
// in path, child, no event
// in path, child, event
// in path, root, no event
// in path, root, event
// in path, context, no event
// in path, context, event
// not in path, child, no event
// not in path, child, event
// not in path, root, no event
// not in path, root, event
// not in path, context, no event
// not in path, context, event

