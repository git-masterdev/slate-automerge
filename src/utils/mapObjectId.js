/**
 * This creates a map between the Automerge objectId and the path to the object.
 * This is used to create Slate operations from Automerge operations.
 */


const SUPPORTED_SLATE_SET_OBJECTS = [
  'document',
  'block',
  'text',
  'character'
]

const SUPPORTED_SLATE_PATH_OBJECTS = [
  'nodes',
  'characters'
]

let path = require('./path');
let concatPath = path.concat, escape = path.escape;


/**
 * @function mapObjectIdToPath
 * @desc Creates a map between the Automerge objectId and the path to the object.
 * @param {Automerge.document} obj - a node from an Automerge document
 * @param {Array} p - the path to the current node
 * @param {Object} pathMap - the mutable map to return
 */
export const mapObjectIdToPath = (obj, p, pathMap) => {
  let path = p || ''
  const isList = obj instanceof Array

  // Iterate object keys instead
  if (!isList) {
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (SUPPORTED_SLATE_PATH_OBJECTS.includes(key)) {
          const thisPath = concatPath(path, escape(key))
          pathMap[obj[key]._objectId] = thisPath
          mapObjectIdToPath(obj[key], thisPath, pathMap)
        }
      }
    }
  }
  else {
    // Assumed to be a list
    obj.forEach((value, key) => {
      const thisPath = concatPath(path, escape(key))
      pathMap[value._objectId] = thisPath
      mapObjectIdToPath(value, thisPath, pathMap)
    });
  }

  return pathMap
}

export const updateObjectIdToPath = (slateOps, automergeDoc, path, pathMap) => {
  slateOps.forEach((op) => {

  })
}