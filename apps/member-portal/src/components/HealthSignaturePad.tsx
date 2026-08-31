import { useEffect, useRef } from "react";
import SignaturePad, {
  type SignaturePadHandle,
} from "./shadix-ui/SignaturePad";

export const SIGNATURE_CHANGE_EVENT = "gymfusion:signature-change";
export const SIGNATURE_CLEAR_EVENT = "gymfusion:signature-clear";

export default function HealthSignaturePad() {
  const signaturePadRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    const clearSignature = () => signaturePadRef.current?.clear();
    window.addEventListener(SIGNATURE_CLEAR_EVENT, clearSignature);
    return () => window.removeEventListener(SIGNATURE_CLEAR_EVENT, clearSignature);
  }, []);

  function publishSignature(signature: string | null) {
    window.dispatchEvent(
      new CustomEvent(SIGNATURE_CHANGE_EVENT, { detail: { signature } }),
    );
  }

  return (
    <div data-signature-provider="@shadix-ui/signature-pad">
      <p id="healthInformationSignatureInstructions" className="gf-visually-hidden">
        Keyboard: press Enter to start drawing, use the arrow keys to move the pen, then press Enter to finish.
      </p>
      <SignaturePad
        ref={signaturePadRef}
        id="healthInformationSignaturePad"
        data-signature-pad
        aria-label="Signature pad. Draw your signature using a mouse, stylus, or touch."
        aria-describedby="healthInformationSignatureInstructions"
        tabIndex={0}
        lineWidth={4}
        onChange={publishSignature}
        penColor="#000000"
      />
    </div>
  );
}
