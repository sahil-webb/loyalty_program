import { useState, useEffect } from "react";

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


  /* ADD RULE LOCALLY */

  const addRule = () => {

    const rule = {
      points:Number(points),
      discount:Number(discount)
    };

    if(type === "regular"){

      setRegularRules([...regularRules,rule]);

    } else {

      setPremiumRules([...premiumRules,rule]);

    }

    setPoints("");
    setDiscount("");

  };


  /* FINAL SAVE */

  const saveAllRules = async () => {

    await fetch("/api/pointrule",{

      method:"POST",

      headers:{
        "Content-Type":"application/json"
      },

      body:JSON.stringify({
        regularRules,
        premiumRules
      })

    });

    alert("Rules saved successfully");

    loadRules();

  };


  return (

    <div style={{padding:"40px"}}>

      <h2>Point Rules</h2>

      <select
        value={type}
        onChange={(e)=>setType(e.target.value)}
      >
        <option value="regular">Regular Customer</option>
        <option value="premium">Premium Customer</option>
      </select>

      <br/><br/>

      <input
        type="number"
        placeholder="Points"
        value={points}
        onChange={(e)=>setPoints(e.target.value)}
      />

      <br/><br/>

      <input
        type="number"
        placeholder="Discount $"
        value={discount}
        onChange={(e)=>setDiscount(e.target.value)}
      />

      <br/><br/>

      <button onClick={addRule}>
        Add Rule
      </button>

      <hr style={{margin:"40px 0"}}/>

      <h3>Regular Customer Rules</h3>

      {regularRules.map((rule,index)=>(

        <div key={index}>
          {rule.points} pts → ${rule.discount} off
        </div>

      ))}

      <hr style={{margin:"40px 0"}}/>

      <h3>Premium Customer Rules</h3>

      {premiumRules.map((rule,index)=>(

        <div key={index}>
          {rule.points} pts → ${rule.discount} off
        </div>

      ))}

      <hr style={{margin:"40px 0"}}/>

      <button
        style={{
          padding:"12px 30px",
          fontSize:"16px",
          background:"#000",
          color:"#fff",
          border:"none",
          cursor:"pointer"
        }}
        onClick={saveAllRules}
      >
        Final Save Rules
      </button>

    </div>

  );

}