import React from 'react'
import Immutable from "immutable";
import { Value } from 'slate'
import slateCustomToJson from "./utils/slateCustomToJson"
import Automerge from 'automerge'
import { Client } from "./client"
import { initialValue } from "./utils/initialAutomergeDoc"


const docId = 1;
let doc = Automerge.init();
const initialSlateValue = Value.fromJSON(initialValue);
doc = Automerge.change(doc, 'Initialize Slate state', doc => {
  doc.note = slateCustomToJson(initialSlateValue.document);
})
const savedAutomergeDoc = Automerge.save(doc);
const maxClients = 6;


class App extends React.Component {

    constructor(props) {
      super(props)

      this.sendMessage = this.sendMessage.bind(this);
      this.clients = [];
      this.docSet = new Automerge.DocSet();
      this.docSet.setDoc(docId, doc);
      this.connections = [];

      this.state = {
        online: true,
        numClients: 1,
      }
    }

    /************************************************
     * Send a change from one client to all others  *
     ************************************************/
    /**
     * @function sendMessage
     * @desc Receive a message from one of the clients
     * @param {number} clientId - The server assigned Client Id
     * @param {Object} message - A message created by Automerge.Connection
     */
    sendMessage = (clientId, message) => {
      if (this.connections.length <= clientId) {
        let connection = new Automerge.Connection(
          this.docSet,
          (message) => {
            // TODO: This is a quick hack since the line right below doesn't work.
            // this.clients[clientId].updateWithRemoteChanges(message);
            this.clients.forEach((client, idx) => {
              if (clientId == idx) {
                client.updateWithRemoteChanges(message);
              }
            })
          }
        )
        connection.open()
        this.connections.push(connection)
      }

      // Need the setTimeout to give time for each client to update it's own
      // Slate Value via setState
      setTimeout(() => {
        console.log(`Server received message from Client ${clientId}`)
        this.connections[clientId].receiveMsg(message)
      })
    }

    /**************************************
     * Add/remove clients  *
     **************************************/
    /**
     * @function updateNumClients
     * @desc Update the number of clients
     * @param {Event} event - A Javascript Event
     */
    updateNumClients = (event) => {
      this.updateNumClientsHelper(event.target.value)
    }

    /**
     * @function addClient
     * @desc Add one client
     * @param {Event} event - A Javascript Event
     */
    addClient = (event) => {
      this.updateNumClientsHelper(this.state.numClients + 1)
    }

    /**
     * @function removeClient
     * @desc Remove one client
     * @param {Event} event - A Javascript Event
     */
    removeClient = (event) => {
      this.updateNumClientsHelper(this.state.numClients - 1)
    }

    /**
     * @function updateNumClientsHelper
     * @desc Update the number of clients
     * @param {number} numClients - The number of clients
     */
    updateNumClientsHelper = (numClients) => {
      const numCurrentClients = this.state.numClients;
      const hasNewClients = numClients > this.state.numClients;

      const updateNewClients = () => {
        this.clients = this.clients.slice(0, numClients);
        this.connections = this.connections.slice(0, numClients);
      }

      if (numClients < 0 || numClients > maxClients) {
        return;
      } else {
        this.setState({numClients: numClients}, updateNewClients);
      }

    }

    /**************************************
     * Handle online/offline connections  *
     **************************************/
    /**
     * @function toggleOnline
     * @desc Turn all clients online
     */
    toggleOnline = () => {
      this.setState({online: true});
      this.clients.forEach((client, idx) => {
        client.toggleOnlineHelper(true);
      })
    }

    /**
     * @function toggleOffline
     * @desc Turn all clients offline
     */
    toggleOffline = () => {
      this.setState({online: false});
      this.clients.forEach((client, idx) => {
        client.toggleOnlineHelper(false);
      })
    }

    /**
     * @function connectionHandler
     * @desc Turn a specific client online/offline
     * @param {number} clientId - The Id of the client to turn on/off
     * @param {boolean} isOnline - Turn online/offline
     */
    connectionHandler = (clientId, isOnline) => {
      if (isOnline) {
        this.connections[clientId].open();
      } else {
        this.connections[clientId].close();
      }
    }

    /********************
     * Render functions *
     ********************/
    render = () => {
        let onlineText = this.state.online ? "CURRENTLY LIVE SYNCING" : "CURRENTLY OFFLINE";
        let onlineTextClass = this.state.online ? "online-text green" : "online-text red";
        let toggleButtonText = this.state.online ? "GO OFFLINE" : "GO ONLINE";
        let clientComponents = [];

        for (let i = 0; i < this.state.numClients; i++) {
          clientComponents.push(
            <div className="client" key={`client-div-${i}`}>
              <Client
                  key={`client-${i}`}
                  clientId={i}
                  docId={docId}
                  ref={(client) => {this.clients[i] = client}}
                  sendMessage={this.sendMessage}
                  online={this.state.online}
                  connectionHandler={this.connectionHandler}
              />
            </div>
          );
        }

        return (
          <div>
            <hr></hr>
            <div className="options">
              <div className="options-text">Options:</div>
              <div className="options-online">
                <button className="online-button" onClick={this.toggleOnline}>All online</button>
                <button className="online-button" onClick={this.toggleOffline}>All offline</button>
              </div>
              <div>
                <span>Number of clients: </span>
                <input
                  type="number"
                  className="numclient-input"
                  onChange={this.updateNumClients}
                  value={this.state.numClients}
                  min={1}
                  max={maxClients}
                />
                <button className="online-button" onClick={this.addClient}>Add client</button>
                <button className="online-button" onClick={this.removeClient}>Remove client</button>
              </div>
            </div>
            <hr></hr>
            {clientComponents}
          </div>
        )
    }

}

export default App
