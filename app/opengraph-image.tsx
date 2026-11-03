import { ImageResponse } from 'next/og';

export const alt = 'CoursePulse — Turn student feedback into better learning experiences.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', padding: '66px 76px',
        backgroundColor: '#f7faf7', color: '#20352a', position: 'relative'
      }}>
        <div style={{position:'absolute',right:-120,top:-170,width:520,height:520,borderRadius:260,border:'2px solid #dcebe0',display:'flex'}}/>
        <div style={{position:'absolute',right:30,top:90,width:260,height:260,borderRadius:130,border:'1px solid #e2eee5',display:'flex'}}/>
        <div style={{display:'flex',alignItems:'center',gap:16,zIndex:1}}> 
          <div style={{width:54,height:54,borderRadius:15,backgroundColor:'#245b3e',display:'flex',alignItems:'center',justifyContent:'center'}}> 
            <div style={{width:31,height:31,borderRadius:16,border:'6px solid white',display:'flex',alignItems:'center',justifyContent:'center'}}> 
              <div style={{width:9,height:9,borderRadius:5,backgroundColor:'#b8d8c0',display:'flex'}}/>
            </div>
          </div>
          <div style={{fontSize:30,fontWeight:800,letterSpacing:'-1px',display:'flex'}}>CoursePulse</div>
          <div style={{marginLeft:14,border:'1px solid #d9e6dc',borderRadius:20,padding:'8px 14px',fontSize:14,color:'#52735e',display:'flex'}}>COLLEGE PROJECT</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:22,maxWidth:900,zIndex:1}}> 
          <div style={{fontSize:66,fontWeight:800,lineHeight:1.08,letterSpacing:'-3px',display:'flex'}}>Turn student feedback into</div>
          <div style={{fontSize:70,fontWeight:800,lineHeight:1.04,letterSpacing:'-3px',color:'#397b56',display:'flex'}}>better learning experiences.</div>
          <div style={{fontSize:24,lineHeight:1.4,color:'#718178',maxWidth:790,display:'flex'}}>A focused workspace for course feedback and aggregate learning analytics.</div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderTop:'1px solid #dfe9e1',paddingTop:20,fontSize:17,color:'#6f8375',zIndex:1}}> 
          <div style={{display:'flex'}}>Student feedback · Instructor insights · Academic administration</div>
          <div style={{display:'flex',fontWeight:700,color:'#397b56'}}>CoursePulse</div>
        </div>
      </div>
    ),
    { ...size }
  );
}