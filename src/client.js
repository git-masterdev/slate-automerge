/**
 * The Slate client.
 */

import { applyImmutableDiffOperations } from "./utils/immutableDiffToAutomerge"
import { applySlateOperations } from "./utils/slateOpsToAutomerge"
import { convertAutomergeToSlateOps } from "./utils/convertAutomergeToSlateOps"
import { Editor } from 'slate-react'
import { Value } from 'slate'
import Automerge from 'automerge'
import Immutable from "immutable";
import React from 'react'
import EditList from 'slate-edit-list'
import automergeJsonToSlate from "./utils/automergeJsonToSlate"



/**
 * @function uselessFunction
 * @desc This is a completely useless function but for some odd reason, the
 *     sync-ing fails to work if I remove this function... I have absolutely no
 *     idea why...
 */
const uselessFunction = (a, b) => {
  return Immutable.is(a, b) ? Immutable.List() : Immutable.List([""]);
};


const plugin = EditList();
const plugins = [
  plugin
]

function renderNode(props: *) {
    const { node, attributes, children, editor } = props;
    const isCurrentItem = plugin.utils
        .getItemsAtRange(editor.value)
        .contains(node);

    switch (node.type) {
        case 'ul_list':
            return <ul {...attributes}>{children}</ul>;
        case 'ol_list':
            return <ol {...attributes}>{children}</ol>;

        case 'list_item':
            return (
                <li
                    className={isCurrentItem ? 'current-item' : ''}
                    title={isCurrentItem ? 'Current Item' : ''}
                    {...props.attributes}
                >
                    {props.children}
                </li>
            );

        case 'paragraph':
            return <div {...attributes}>{children}</div>;
        case 'heading':
            return <h1 {...attributes}>{children}</h1>;
        default:
            return <div {...attributes}>{children}</div>;
    }
}


export class Client extends React.Component {

    constructor(props) {
      super(props)

      this.onChange = this.onChange.bind(this)
      this.doc = Automerge.load(this.props.savedAutomergeDoc)
      this.pathMap = null;

      const initialValue = automergeJsonToSlate({
        "document": {...this.doc.note}
      })
      const initialSlateValue = Value.fromJSON(initialValue);

      // Should build the Slate value from this.doc

      this.state = {
        value: initialSlateValue,
        online: true,
        docOfflineHistory: Immutable.List(),
      }
    }

    /**
     * @function getStoredLocalChanges
     * @desc Return the list of stored local changes, then clear the changes
     */
    getStoredLocalChanges = () => {
      setTimeout(() => {
        this.setState({docOfflineHistory: Immutable.List()})
      })
      return this.state.docOfflineHistory;
    }

    /**
     * @function getAutomergeDoc
     * @desc Return the Automerge document
     */
    getAutomergeDoc = () => {
      return this.doc;
    }

    /***************************************
     * UPDATE CLIENT FROM REMOTE OPERATION *
     ***************************************/

    /**
     * @function updateWithBatchedRemoteChanges
     * @desc Update the client with a list of changes
     * @param {Immutable.List} changesList - An Array of changes generated by Automerge.getChanges
     */
    updateWithBatchedRemoteChanges = ( changesList ) => {
      // let docNew = this.doc;
      let newValue = this.state.value;
      changesList.forEach((changes) => {
        const docNew = Automerge.applyChanges(this.doc, changes)
        const opSetDiff = Automerge.diff(this.doc, docNew)
        this.doc = docNew;
        newValue = this.updateWithAutomergeOperations(newValue, opSetDiff);
      })
      this.setState({ value: newValue })
    }

    /**
     * @function updateWithNewAutomergeDoc
     * @desc Update the client with an Automerge document.
     *     NOT USED
     * @param {Automerge.document} automergeDoc - The new Automerge document to update the client to
     */
    updateWithNewAutomergeDoc = ( automergeDoc ) => {
      const changes = Automerge.getChanges(this.doc, automergeDoc)
      this.updateWithRemoteChanges(changes)
    }

    /**
     * @function updateWithRemoteChanges
     * @desc Update the Automerge document with changes from another client
     * @param {Array} changes - A single set of changes generated by Automerge.chages
     */
    updateWithRemoteChanges = ( changes ) => {
      const docNew = Automerge.applyChanges(this.doc, changes)
      const opSetDiff = Automerge.diff(this.doc, docNew)
      this.doc = docNew;
      const newValue = this.updateWithAutomergeOperations(this.state.value, opSetDiff);
      this.setState({ value: newValue })
    }

    /**
     * @function updateWithAutomergeOperations
     * @desc Update the client with a list of Automerge operations. If an error
     *     occurs, reload the document using Automerge as the ground truth.
     * @param {Value} currentValue - The current (or latest) Slate Value
     * @param {Array} opSetDiff - The Automerge operations generated by Automerge.diff
     */
    updateWithAutomergeOperations = (currentValue, opSetDiff) => {
      // Convert the changes from the Automerge document to Slate operations
      try {
        const slateOps = convertAutomergeToSlateOps(opSetDiff, currentValue)
        const change = currentValue.change()

        // Apply the operation
        try {
          change.applyOperations(slateOps)
        } catch (err) { }

        return change.value
      } catch (e) {
        // If an error occurs, release the Slate Value based on the Automerge
        // document, which is the ground truth.
        console.error(e)
        const newJson = automergeJsonToSlate({
          "document": {...this.doc.note}
        })
        const newValue = Value.fromJSON(newJson)
        return newValue
      }
    }

    /**************************************
     * UPDATE CLIENT FROM LOCAL OPERATION *
     **************************************/
    onChange = ({ operations, value }) => {

      console.log(`Client ${this.props.clientNumber}`)

      const differences = uselessFunction(this.state.value.document, value.document);
      console.log(differences)

      this.setState({ value: value })

      // Run only if the Slate value has changed.
      // For some reason, when I don't have this nearly trivial condition,
      // the syncing doesn't work as I expect. I still need to investigate why.
      if (differences.size) {

        const docNew = Automerge.change(this.doc, `Client ${this.props.clientNumber}`, doc => {
          // Approach 1 which uses the difference between two Automerge documents
          // to calculate the operations.
          // applyImmutableDiffOperations(doc, differences)

          // Approach 2 which directly uses the Slate operations to modify the
          // Automerge document.
          applySlateOperations(doc, operations)
        })

        // Get Automerge changes
        const changes = Automerge.getChanges(this.doc, docNew)

        // Update doc
        this.doc = docNew

        // If online, broadcast changes to other clients.
        // If offline, store changes.
        if (this.props.online) {
          this.props.broadcast(this.props.clientNumber, changes);
        } else {
          this.setState({
            docOfflineHistory: this.state.docOfflineHistory.push(changes)
          })
        }
      }
    }

    /*****************
     * RENDER CLIENT *
     *****************/
    render = () => {
        return (
            <div>
              <span><u>Client: {this.props.clientNumber}</u></span>
              <Editor
                  key={this.props.clientNumber}
                  ref={(e) => {this.editor = e}}
                  value={this.state.value}
                  onChange={this.onChange}
                  renderNode={renderNode}
                  plugins={plugins}
              />
            </div>
        )
    }
}
