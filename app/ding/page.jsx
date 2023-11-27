"use client";
import { Web5 } from "@web5/api";
import { useEffect, useState } from "react";

const DingApp = () => {
  const [web5, setWeb5] = useState(null);
  const [myDid, setMyDid] = useState(null);
  const [recipientDid, setRecipientDid] = useState("");

  const [noteValue, setNoteValue] = useState([]);
  const [allDings, setAllDings] = useState([]);

  // THIS USE EFFECT METHOD CONNECTS TO WEB5 AND GENERATES A DID FOR YOU
  useEffect(() => {
    const initWeb5 = async () => {
      const { web5, did } = await Web5.connect();
      setWeb5(web5);
      setMyDid(did);

      console.log(did);

      if (web5 && did) {
        await configureProtocol(web5, did);
        await fetchDings(web5, did);
      }
    };
    initWeb5();
  }, []);

  // THIS USE EFFECT METHOD FETCHES DINGS EVERY 2 SECONDS
  useEffect(() => {
    if (!web5 || !myDid) return;
    const intervalId = setInterval(async () => {
      await fetchDings(web5, myDid);
    }, 2000);

    return () => clearInterval(intervalId);
  }, [web5, myDid]);

  /**
   * Fetches sent dings from the web5 server.
   * @param {object} web5 - The web5 object.
   * @param {string} did - The DID (Decentralized Identifier).
   * @returns {Promise<Array>} - A promise that resolves to an array of sent dings.
   */
  const fetchSentDings = async (web5, did) => {
    const response = await web5.dwn.records.query({
      message: {
        filter: {
          protocol: "http://learningweb5.com/ding",
        },
      },
    });

    if (response.status.code === 200) {
      const sentDings = await Promise.all(
        response.records.map(async (record) => {
          const data = await record.data.json();
          return data;
        })
      );
      console.log(sentDings, "I sent these dings");
      return sentDings;
    } else {
      console.log("error", response.status);
    }
  };

  /**
   * Fetches received dings from the web5 API.
   * @param {object} web5 - The web5 object.
   * @param {string} did - The decentralized identifier.
   * @returns {Promise<Array>} - A promise that resolves to an array of received dings.
   */
  const fetchReceivedDings = async (web5, did) => {
    const response = await web5.dwn.records.query({
      from: did,
      message: {
        filter: {
          protocol: "http://learningweb5.com/ding",
          schema: "http://learningweb5.com/ding/ding",
        },
      },
    });

    if (response.status.code === 200) {
      const receivedDings = await Promise.all(
        response.records.map(async (record) => {
          const data = await record.data.json();
          return data;
        })
      );
      console.log(receivedDings, "I received these dings");
      return receivedDings;
    } else {
      console.log("error", response.status);
    }
  };

  /**
   * Fetches dings from the server. THIS COMBINES ALL SENT DINGS AND RECEIVED DINGS
   *
   * @param {object} web5 - The web5 object.
   * @param {string} did - The ID of the user.
   * @returns {Promise<void>} - A promise that resolves when the dings are fetched.
   */

  const fetchDings = async (web5, did) => {
    const receivedDings = await fetchReceivedDings(web5, did);
    const sentDings = await fetchSentDings(web5, did);
    const allMessages = [...(receivedDings || []), ...(sentDings || [])];
    setAllDings(allMessages);
  };

  /**
   * Creates a protocol definition for the dinger application.
   * @returns {Object} The protocol definition object.
   */

  const createProtocolDefinition = () => {
    console.log("Creating protocol definition");
    const dingerProtocolDefinition = {
      protocol: "http://learningweb5.com/ding",
      published: true,
      types: {
        ding: {
          schema: "http://learningweb5.com/ding/ding",
          dataFormats: ["application/json"],
        },
      },
      structure: {
        ding: {
          $actions: [
            { who: "anyone", can: "write" },
            { who: "author", of: "ding", can: "read" },
            { who: "recipient", of: "ding", can: "read" },
          ],
        },
      },
    };
    return dingerProtocolDefinition;
  };

  const queryForProtocol = async (web5) => {
    console.log("Querying local protocol");
    return await web5.dwn.protocols.query({
      message: {
        filter: {
          protocol: "http://learningweb5.com/ding",
        },
      },
    });
  };

  const installLocalProtocol = async (web5, protocolDefinition) => {
    console.log("Installing local protocol");
    return await web5.dwn.protocols.configure({
      message: {
        definition: protocolDefinition,
      },
    });
  };

  /**
   * Configures the protocol for a given web5 instance and DID.
   * @param {Web5} web5 - The web5 instance.
   * @param {string} did - The DID (Decentralized Identifier).
   * @returns {Promise<void>} - A promise that resolves when the protocol configuration is complete.
   */
  const configureProtocol = async (web5, did) => {
    console.log("Configuring protocol");
    const protocolDefinition = await createProtocolDefinition();

    const { protocols: localProtocol, status: localProtocolStatus } =
      await queryForProtocol(web5);
    console.log({ localProtocol, localProtocolStatus });
    if (localProtocolStatus.code !== 200 || localProtocol.length === 0) {
      const { protocol, status } = await installLocalProtocol(
        web5,
        protocolDefinition
      );
      console.log("Protocol installed locally", protocol, status);

      const { status: configureRemoteStatus } = await protocol.send(did);
      console.log(
        "Did the protocol install on the remote DWN?",
        configureRemoteStatus
      );
    } else {
      console.log("Protocol already installed");
    }
  };

  /**
   * Constructs a ding object with the current date, time, and other properties.
   * @returns {Object} The constructed ding object.
   */
  const constructDing = () => {
    const currentDate = new Date().toLocaleDateString();
    const currentTime = new Date().toLocaleTimeString();
    const ding = {
      sender: myDid,
      note: noteValue,
      recipient: recipientDid,
      timestampWritten: `${currentDate} ${currentTime}`,
    };
    return ding;
  };

  /**
   * Writes the given 'ding' data to the web5.dwn.records.
   * @param {Object} ding - The data to be written.
   * @returns {Object} - The record object.
   */
  const writeToDwn = async (ding) => {
    const { record } = await web5.dwn.records.write({
      data: ding,
      message: {
        protocol: "http://learningweb5.com/ding",
        protocolPath: "ding",
        schema: "http://learningweb5.com/ding/ding",
        recipient: recipientDid,
      },
    });
    return record;
  };

  /**
   * Sends a record to the recipient.
   * @param {Object} record - The record to be sent.
   * @returns {Promise} - A promise that resolves when the record is sent.
   */
  const sendRecord = async (record) => {
    return await record.send(recipientDid);
  };

  /**
   * Handles the form submission.
   * 
   * @param {Event} e - The form submission event.
   * @returns {Promise<void>} - A promise that resolves when the form submission is complete.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    const ding = constructDing();
    const record = await writeToDwn(ding);
    const { status } = await sendRecord(record);

    console.log("Send record status", status);

    await fetchDings(web5, myDid);
  };

  return (
    <main className="bg-red-300">
      <h1>Ding app</h1>
      <form onSubmit={handleSubmit}>
        <textarea
          value={noteValue}
          onChange={(e) => setNoteValue(e.target.value)}
          placeholder="Write your message here"
        />

        <br />
        <br />

        <input
          type="text"
          value={recipientDid}
          onChange={(e) => setRecipientDid(e.target.value)}
          placeholder="Enter recipient's DID"
        />
        <div>
          <button type="submit">Submit Message</button>
        </div>
      </form>
      <h2>Dings</h2>
      {allDings.length > 0 &&
        allDings.map((ding, index) => (
          <div key={index}>
            <p>{ding.note}</p>
            <p>{ding.timestampWritten}</p>
          </div>
        ))}
    </main>
  );
};

export default DingApp;
