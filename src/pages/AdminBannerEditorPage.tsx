import React from 'react';
import { AdminBannerEditor } from '../components/AdminBannerEditor';

const AdminBannerEditorPage: React.FC = () => {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <AdminBannerEditor />
    </div>
  );
};

export default AdminBannerEditorPage;
