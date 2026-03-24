import { useState } from "react";

export default function PointRule() {

  const [points, setPoints] = useState("");
  const [discount, setDiscount] = useState("");
  const [type, setType] = useState("regular");

  const saveRule = async () => {

    await fetch("/api/pointrule", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type,
        points: Number(points),
        discount: Number(discount)
      })
    });

    alert("Rule saved");

  };

  return (
    <div style={{padding:"40px"}}>

      <h1>Point Rule Settings</h1>

      <div style={{marginBottom:"20px"}}>

        <label>Customer Type</label>

        <select
          value={type}
          onChange={(e)=>setType(e.target.value)}
        >
          <option value="regular">Regular</option>
          <option value="premium">Premium</option>
        </select>

      </div>

      <div style={{marginBottom:"20px"}}>

        <label>Points</label>

        <input
          type="number"
          value={points}
          onChange={(e)=>setPoints(e.target.value)}
        />

      </div>

      <div style={{marginBottom:"20px"}}>

        <label>Discount ($)</label>

        <input
          type="number"
          value={discount}
          onChange={(e)=>setDiscount(e.target.value)}
        />

      </div>

      <button onClick={saveRule}>
        Save Rule
      </button>

    </div>
  );
}