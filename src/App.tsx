import Layout from "./components/Layout";

function App() {
  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary">Diagnóstico de Red</h1>
        <p className="mt-2 text-base-content/60">
          Ingrese los datos del equipo a diagnosticar.
        </p>
      </div>
    </Layout>
  );
}

export default App;
