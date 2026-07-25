import Layout from "./components/Layout";
import DiagnosticForm, { type DiagnosticInput } from "./components/DiagnosticForm";

function App() {
  const handleDiagnostic = (input: DiagnosticInput) => {
    console.log("Diagnostic requested:", input);
  };

  return (
    <Layout>
      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-bold text-primary mb-1">Diagnóstico de Red</h1>
        <p className="text-base-content/60 mb-6">
          Ingrese los datos del equipo a diagnosticar.
        </p>
        <DiagnosticForm onSubmit={handleDiagnostic} />
      </div>
    </Layout>
  );
}

export default App;
