# ProofsFulfillmentGenerateRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**IntentHash** | **string** | 0x-prefixed 32-byte hex string | 
**OutputAmount** | **string** |  | 
**OutputBlinding** | **string** | 0x-prefixed 32-byte hex string | 
**MinOutputAmount** | **string** |  | 
**RecipientStealth** | **string** | 0x-prefixed 32-byte hex string | 
**SolverId** | **string** |  | 
**SolverSecret** | **string** | 0x-prefixed 32-byte hex string | 
**OracleAttestation** | [**ProofsFulfillmentGenerateRequestOracleAttestation**](ProofsFulfillmentGenerateRequestOracleAttestation.md) |  | 
**FulfillmentTime** | **int32** |  | 
**Expiry** | **int32** |  | 

## Methods

### NewProofsFulfillmentGenerateRequest

`func NewProofsFulfillmentGenerateRequest(intentHash string, outputAmount string, outputBlinding string, minOutputAmount string, recipientStealth string, solverId string, solverSecret string, oracleAttestation ProofsFulfillmentGenerateRequestOracleAttestation, fulfillmentTime int32, expiry int32, ) *ProofsFulfillmentGenerateRequest`

NewProofsFulfillmentGenerateRequest instantiates a new ProofsFulfillmentGenerateRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewProofsFulfillmentGenerateRequestWithDefaults

`func NewProofsFulfillmentGenerateRequestWithDefaults() *ProofsFulfillmentGenerateRequest`

NewProofsFulfillmentGenerateRequestWithDefaults instantiates a new ProofsFulfillmentGenerateRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetIntentHash

`func (o *ProofsFulfillmentGenerateRequest) GetIntentHash() string`

GetIntentHash returns the IntentHash field if non-nil, zero value otherwise.

### GetIntentHashOk

`func (o *ProofsFulfillmentGenerateRequest) GetIntentHashOk() (*string, bool)`

GetIntentHashOk returns a tuple with the IntentHash field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetIntentHash

`func (o *ProofsFulfillmentGenerateRequest) SetIntentHash(v string)`

SetIntentHash sets IntentHash field to given value.


### GetOutputAmount

`func (o *ProofsFulfillmentGenerateRequest) GetOutputAmount() string`

GetOutputAmount returns the OutputAmount field if non-nil, zero value otherwise.

### GetOutputAmountOk

`func (o *ProofsFulfillmentGenerateRequest) GetOutputAmountOk() (*string, bool)`

GetOutputAmountOk returns a tuple with the OutputAmount field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOutputAmount

`func (o *ProofsFulfillmentGenerateRequest) SetOutputAmount(v string)`

SetOutputAmount sets OutputAmount field to given value.


### GetOutputBlinding

`func (o *ProofsFulfillmentGenerateRequest) GetOutputBlinding() string`

GetOutputBlinding returns the OutputBlinding field if non-nil, zero value otherwise.

### GetOutputBlindingOk

`func (o *ProofsFulfillmentGenerateRequest) GetOutputBlindingOk() (*string, bool)`

GetOutputBlindingOk returns a tuple with the OutputBlinding field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOutputBlinding

`func (o *ProofsFulfillmentGenerateRequest) SetOutputBlinding(v string)`

SetOutputBlinding sets OutputBlinding field to given value.


### GetMinOutputAmount

`func (o *ProofsFulfillmentGenerateRequest) GetMinOutputAmount() string`

GetMinOutputAmount returns the MinOutputAmount field if non-nil, zero value otherwise.

### GetMinOutputAmountOk

`func (o *ProofsFulfillmentGenerateRequest) GetMinOutputAmountOk() (*string, bool)`

GetMinOutputAmountOk returns a tuple with the MinOutputAmount field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMinOutputAmount

`func (o *ProofsFulfillmentGenerateRequest) SetMinOutputAmount(v string)`

SetMinOutputAmount sets MinOutputAmount field to given value.


### GetRecipientStealth

`func (o *ProofsFulfillmentGenerateRequest) GetRecipientStealth() string`

GetRecipientStealth returns the RecipientStealth field if non-nil, zero value otherwise.

### GetRecipientStealthOk

`func (o *ProofsFulfillmentGenerateRequest) GetRecipientStealthOk() (*string, bool)`

GetRecipientStealthOk returns a tuple with the RecipientStealth field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRecipientStealth

`func (o *ProofsFulfillmentGenerateRequest) SetRecipientStealth(v string)`

SetRecipientStealth sets RecipientStealth field to given value.


### GetSolverId

`func (o *ProofsFulfillmentGenerateRequest) GetSolverId() string`

GetSolverId returns the SolverId field if non-nil, zero value otherwise.

### GetSolverIdOk

`func (o *ProofsFulfillmentGenerateRequest) GetSolverIdOk() (*string, bool)`

GetSolverIdOk returns a tuple with the SolverId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSolverId

`func (o *ProofsFulfillmentGenerateRequest) SetSolverId(v string)`

SetSolverId sets SolverId field to given value.


### GetSolverSecret

`func (o *ProofsFulfillmentGenerateRequest) GetSolverSecret() string`

GetSolverSecret returns the SolverSecret field if non-nil, zero value otherwise.

### GetSolverSecretOk

`func (o *ProofsFulfillmentGenerateRequest) GetSolverSecretOk() (*string, bool)`

GetSolverSecretOk returns a tuple with the SolverSecret field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSolverSecret

`func (o *ProofsFulfillmentGenerateRequest) SetSolverSecret(v string)`

SetSolverSecret sets SolverSecret field to given value.


### GetOracleAttestation

`func (o *ProofsFulfillmentGenerateRequest) GetOracleAttestation() ProofsFulfillmentGenerateRequestOracleAttestation`

GetOracleAttestation returns the OracleAttestation field if non-nil, zero value otherwise.

### GetOracleAttestationOk

`func (o *ProofsFulfillmentGenerateRequest) GetOracleAttestationOk() (*ProofsFulfillmentGenerateRequestOracleAttestation, bool)`

GetOracleAttestationOk returns a tuple with the OracleAttestation field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOracleAttestation

`func (o *ProofsFulfillmentGenerateRequest) SetOracleAttestation(v ProofsFulfillmentGenerateRequestOracleAttestation)`

SetOracleAttestation sets OracleAttestation field to given value.


### GetFulfillmentTime

`func (o *ProofsFulfillmentGenerateRequest) GetFulfillmentTime() int32`

GetFulfillmentTime returns the FulfillmentTime field if non-nil, zero value otherwise.

### GetFulfillmentTimeOk

`func (o *ProofsFulfillmentGenerateRequest) GetFulfillmentTimeOk() (*int32, bool)`

GetFulfillmentTimeOk returns a tuple with the FulfillmentTime field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetFulfillmentTime

`func (o *ProofsFulfillmentGenerateRequest) SetFulfillmentTime(v int32)`

SetFulfillmentTime sets FulfillmentTime field to given value.


### GetExpiry

`func (o *ProofsFulfillmentGenerateRequest) GetExpiry() int32`

GetExpiry returns the Expiry field if non-nil, zero value otherwise.

### GetExpiryOk

`func (o *ProofsFulfillmentGenerateRequest) GetExpiryOk() (*int32, bool)`

GetExpiryOk returns a tuple with the Expiry field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetExpiry

`func (o *ProofsFulfillmentGenerateRequest) SetExpiry(v int32)`

SetExpiry sets Expiry field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


