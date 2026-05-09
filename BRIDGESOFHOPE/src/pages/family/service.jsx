import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Legacy /services URL: fees & inclusions now open as a modal on Home.
 */
export default function Service() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/home', { replace: true, state: { openServices: true } });
  }, [navigate]);
  return null;
}
