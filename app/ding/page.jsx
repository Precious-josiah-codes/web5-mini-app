"use client";
import { Web5 } from "@web5/api";
import { useEffect, useState } from "react";

const DingApp = () => {
  const [web5, setWeb5] = useState(null);
  const [myDid, setMyDid] = useState(null);
  const [recipientDid, setRecipientDid] = useState("");
  const [receivedDings, setReceivedDings] = useState([]);
  const [sentDings, setSentDings] = useState([]);
  const [noteValue, setNoteValue] = useState([]);

  useEffect(() => {
    const initWeb5 = async () => {
      const { web5, did } = await Web5.connect();
      setWeb5(web5);
      setMyDid(did);

      console.log(did);

      if (web5 && did) {
        await configureProtocol(web5);
        await fetchDings(web5, did);
      }
    };
    initWeb5();
  }, []);

  const configureProtocol = async (web5) => {
    const dingerProtocolDefinition = {
      protocol: "http://localhost:3000/ding",
      published: true,
      types: {
        ding: {
          schema: "http://localhost:3000/ding/ding",
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
    // This function checks if the protocol already exists.
    const { protocols, status: protocolStatus } =
      await web5.dwn.protocols.query({
        message: {
          filter: {
            protocol: "http://localhost:3000/ding",
          },
        },
      });

    console.log("protocols =>>", protocols);
    console.log("protocolStatus =>>", protocolStatus);

    // This function installs the protocol.
    if (protocolStatus.code !== 200 || protocols.length === 0) {
      const result = await web5.dwn.protocols.configure({
        message: {
          definition: dingerProtocolDefinition,
        },
      });
      console.log("Configure protocol status", result);
    }
  };

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

  const writeToDwn = async (ding) => {
    const { record } = await web5.dwn.records.write({
      data: ding,
      message: {
        protocol: "http://localhost:3000/ding",
        protocolPath: "ding",
        schema: "http://localhost:3000/ding/ding",
        recipient: recipientDid,
      },
    });
    return record;
  };

  const sendRecord = async (record) => {
    return await record.send(recipientDid);
  };

  const fetchDings = async (web5, did) => {
    const { records, status: recordStatus } = await web5.dwn.records.query({
      message: {
        filter: {
          protocol: "http://localhost:3000/ding",
          protocolPath: "ding",
        },
        dateSort: "createdAscending",
      },
    });

    try {
      const results = await Promise.all(
        records.map(async (record) => record.data.json())
      );

      if (recordStatus.code == 200) {
        const received = results.filter((result) => result?.recipient === did);
        const sent = results.filter((result) => result?.sender === did);
        setReceivedDings(received);
        setSentDings(sent);

        console.log(receivedDings, "recieved dings");
        console.log(sentDings, "sent dings");
      }
    } catch (error) {
      console.error(error);
    }
  };

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
    </main>
  );
};

export default DingApp;
