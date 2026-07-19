async function testUpdate() {
  try {
    const loginRes = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'psicologia@neurorobi.com',
        password: 'psicologia2026'
      })
    });
    
    const loginData = await loginRes.json();
    console.log('Login success, user:', loginData.user);
    if (!loginData.user) {
      console.log('Login data is:', loginData);
      return;
    }
    const userId = loginData.user.id;
    
    // Test with JSON first
    console.log('Testing with JSON body...');
    const updateResJSON = await fetch(`http://localhost:3001/api/auth/profile/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dr. Maria Lopez Updated JSON'
      })
    });
    console.log('JSON Update status:', updateResJSON.status);
    console.log('JSON Update response:', await updateResJSON.json());

    // Test with multipart/form-data
    console.log('Testing with multipart/form-data...');
    const formData = new FormData();
    formData.append('name', 'Dr. Maria Lopez Updated Multipart');
    
    const updateResMultipart = await fetch(`http://localhost:3001/api/auth/profile/${userId}`, {
      method: 'PUT',
      body: formData
    });
    console.log('Multipart Update status:', updateResMultipart.status);
    console.log('Multipart Update response:', await updateResMultipart.json());
  } catch (error) {
    console.error('Error during test:', error);
  }
}

testUpdate();
