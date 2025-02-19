import React from "react";


const Disclaimer = () => {
  return (
        <div style={{"text-align":"center"}}>
            <table align="center" style={{"text-align":"left","width":"97%"}}>
                <tbody>
                <tr>
                    
                    <td className="scoreboard">
                    <h3>DISCLAIMER</h3>
                        The information provided in this application is for general information purposes only. While we endeavour to keep such information up to date and correct, we make no representations or warranties of any kind, expressed or implied, about the completeness, accuracy, reliability, suitability, or availability of the information, calculations, or any other content appearing in this application for any purpose. Any reliance you place on such information is strictly at your own risk. In no event will the creators of this application nor any related third parties be liable for any loss or damage whatsoever arising from or in connection with the use of this application.<br /></td>
                </tr>
                <tr>
                    <td className="scoreboard"><h3>PRIVACY POLICY</h3>
                    This application and our third party analytics and advertising partners may collect non-personally identifiable information about you and your device in order to improve this application and optimize displayed advertisements. Any personally identifiable information you provide to us outside of this application through email, social media, or any other method of contact will not be shared with third parties for the purposes of spam, advertisement, or solicitation.
                    <br /></td>
                </tr>
                <tr>
                    <td className="scoreboard"><h3>COOKIE POLICY</h3>
                    This application and our third party analytics and advertising partners may place "cookies" on your device. Cookies are an industry standard that most major websites use. A cookie is a small text file stored on your device which enables us to remember your acceptance of these policies as well as other application settings. Our third party analytics and advertising partners may also place cookies on your device for the purposes of tracking your usage of this application and displaying targeted advertisements. Cookies are required for the use of this application. If you do not consent to our use of cookies, please close this application now.</td>
                </tr>

                <tr>
                    <td className="scoreboard">
                        <b>I AGREE</b><br />
                        This application and our third-party analytics and advertising partners may place "cookies" on your device. Cookies are an industry standard that most major websites use. A cookie is a small text file stored on your device which enables us to remember your acceptance of these policies as well as other application settings. Our third-party analytics and advertising partners may also place cookies on your device for the purposes of tracking your usage of this application and displaying targeted advertisements. Cookies are required for the use of this application. If you do not consent to our use of cookies, please close this application now.
                    </td>
                </tr>

                <tr>
                    <td>
                        <div style={{ display: 'flex', alignItems: 'center', marginTop: '15px' }}>
                            <input
                                type="checkbox"
                                id="agreeCheckbox"
                                required
                                style={{ marginRight: '10px' }}
                            />
                            <label htmlFor="agreeCheckbox" style={{ marginRight: '20px' }}>
                                I agree to the above terms
                            </label>
                            <button
                                onClick={() => {
                                    const checkbox = document.getElementById('agreeCheckbox');
                                    if (checkbox.checked) {
                                        // Replace with actual navigation logic if using React Router
                                        window.location.href = '/Dailyscreen';
                                    } else {
                                        alert('Please agree to the terms before proceeding.');
                                    }
                                }}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#007BFF',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: 'pointer'
                                }}
                            >
                                Proceed
                            </button>
                        </div>
                    </td>
                </tr>

                
                </tbody>
            </table>
        </div>
  );
};

export default Disclaimer;









