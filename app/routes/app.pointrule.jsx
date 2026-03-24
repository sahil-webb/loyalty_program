import { useEffect, useState } from "react";

export default function PointRule() {

  const [points,setPoints] = useState("");
  const [discount,setDiscount] = useState("");
  const [type,setType] = useState("regular");

  const [regularRules,setRegularRules] = useState([]);
  const [premiumRules,setPremiumRules] = useState([]);

  const loadRules = async () => {

    const res = await fetch("/api/pointrule");
    const data = await res.json();

    setRegularRules(data.regular);
    setPremiumRules(data.premium);

  };

  useEffect(()=>{
    loadRules();
  },[]);

  const saveRule = async () => {

    await fetch("/api/pointrule",{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        type,
        points,
        discount
      })
    });

    setPoints("");
    setDiscount("");

    loadRules();

  };

  return (

    <div style={{padding:"40px"}}>

      <h2>Point Rules</h2>

      <div style={{marginBottom:"20px"}}>

        <select
          value={type}
          onChange={(e)=>setType(e.target.value)}
        >
          <option value="regular">Regular Customer</option>
          <option value="premium">Premium Customer</option>
        </select>

      </div>

      <div style={{marginBottom:"10px"}}>

        <input
          type="number"
          placeholder="Points"
          value={points}
          onChange={(e)=>setPoints(e.target.value)}
        />

      </div>

      <div style={{marginBottom:"10px"}}>

        <input
          type="number"
          placeholder="Discount $"
          value={discount}
          onChange={(e)=>setDiscount(e.target.value)}
        />

      </div>

      <button onClick={saveRule}>
        Save Rule
      </button>

      <hr style={{margin:"40px 0"}}/>

      <h3>Regular Customer Rules</h3>

      {regularRules.map((rule)=>(
        <div key={rule.id}>
          {rule.points} pts → ${rule.discount} off
        </div>
      ))}

      <hr style={{margin:"40px 0"}}/>

      <h3>Premium Customer Rules</h3>

      {premiumRules.map((rule)=>(
        <div key={rule.id}>
          {rule.points} pts → ${rule.discount} off
        </div>
      ))}

    </div>

  );
}