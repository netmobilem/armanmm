import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.js';

const Login = lazy(() => import('./pages/Login.js'));
const Dashboard = lazy(() => import('./pages/Dashboard.js'));
const Users = lazy(() => import('./pages/Users.js'));
const UserDetail = lazy(() => import('./pages/UserDetail.js'));
const Configs = lazy(() => import('./pages/Configs.js'));
const ConfigWizard = lazy(() => import('./pages/ConfigWizard.js'));
const Nodes = lazy(() => import('./pages/Nodes.js'));
const NodeWizard = lazy(() => import('./pages/NodeWizard.js'));
const Subscriptions = lazy(() => import('./pages/Subscriptions.js'));
const Plans = lazy(() => import('./pages/Plans.js'));
const Groups = lazy(() => import('./pages/Groups.js'));
const Resellers = lazy(() => import('./pages/Resellers.js'));
const ApiKeys = lazy(() => import('./pages/ApiKeys.js'));
const Audit = lazy(() => import('./pages/Audit.js'));
const Activity = lazy(() => import('./pages/Activity.js'));
const Reports = lazy(() => import('./pages/Reports.js'));
const Settings = lazy(() => import('./pages/Settings.js'));
const Admins = lazy(() => import('./pages/Admins.js'));
const Health = lazy(() => import('./pages/Health.js'));
const SubPage = lazy(() => import('./pages/SubPage.js'));

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/sub/:token" element={<SubPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/users" element={<Users />} />
        <Route path="/users/:id" element={<UserDetail />} />
        <Route path="/configs" element={<Configs />} />
        <Route path="/configs/new" element={<ConfigWizard />} />
        <Route path="/nodes" element={<Nodes />} />
        <Route path="/nodes/new" element={<NodeWizard />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/resellers" element={<Resellers />} />
        <Route path="/api-keys" element={<ApiKeys />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admins" element={<Admins />} />
        <Route path="/health" element={<Health />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
