import React, { useEffect, useState } from 'react';
import { Home, Welcome, Auth, NewAccount } from './pages';
import { Routes, Route } from 'react-router-dom';
import { ExtensionService } from './services/Extension.service';
import { INIT } from './constants';
import './App.css';
import CircularProgress from '@mui/material/CircularProgress';
import { BrowserProvider } from 'ethers'


function App() {
  const [inited, setInited] = useState(false);
  const [error, setError] = useState('');
  
  useEffect(()=>{
    const init = async () => {
      // 1) grab the real MetaMask signer
      const browserProvider = new BrowserProvider(window.ethereum);
      await browserProvider.send("eth_requestAccounts", []);
      const rawSigner = await browserProvider.getSigner();

      // 2) wrap it so `.connect(...)` just returns the same signer
      const signer = new Proxy(rawSigner, {
        get(target, prop, receiver) {
          if (prop === "connect") {
            // ignore the passed provider and return the original signer
            return (_provider) => target;
          }
          // forward everything else
          return Reflect.get(target, prop, receiver);
        },
      });

      const { status } = await ExtensionService.init(signer);
      if(status === INIT)
        setInited(true);
      else
        setError('Extension services cant be initialized');
    }
    init()
        .catch(error => {
          setError(error)
          console.log(error);
        });
  },[])

  return (
    <div className="App">
      {!inited && error && <div>
        <h6>{error}</h6>
      </div>}
      { inited && !error ? (<Routes>
        <Route path={'/'} element={<Home/>}/>
        <Route path={'/welcome'} element={<Welcome/>} />
        <Route path={'/auth'} element={<Auth/>} />
        <Route path={'/newAccount'} element={<NewAccount/>} />
      </Routes>) : (<CircularProgress/>)
      }
    </div>
  );
}

export default App;
