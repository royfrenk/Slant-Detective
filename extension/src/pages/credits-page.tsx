/**
 * SD-028: Credits reference page entry point at src/pages/credits.html
 *
 * Re-exports the Credits component from src/credits/ so both
 * credits.html (root) and src/pages/credits.html render identical content.
 */
import { createRoot } from 'react-dom/client';
import './page.css';
import Credits from '../credits/credits';

const container = document.getElementById('root');
if (container !== null) {
  createRoot(container).render(<Credits />);
}
