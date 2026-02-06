# CsplUnwrapRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**CsplMint** | **string** | C-SPL token mint identifier | 
**EncryptedAmount** | **string** | Encrypted amount as hex | 
**Owner** | **string** | Base58-encoded Solana public key | 
**Proof** | Pointer to **string** | Optional proof of ownership | [optional] 

## Methods

### NewCsplUnwrapRequest

`func NewCsplUnwrapRequest(csplMint string, encryptedAmount string, owner string, ) *CsplUnwrapRequest`

NewCsplUnwrapRequest instantiates a new CsplUnwrapRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCsplUnwrapRequestWithDefaults

`func NewCsplUnwrapRequestWithDefaults() *CsplUnwrapRequest`

NewCsplUnwrapRequestWithDefaults instantiates a new CsplUnwrapRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetCsplMint

`func (o *CsplUnwrapRequest) GetCsplMint() string`

GetCsplMint returns the CsplMint field if non-nil, zero value otherwise.

### GetCsplMintOk

`func (o *CsplUnwrapRequest) GetCsplMintOk() (*string, bool)`

GetCsplMintOk returns a tuple with the CsplMint field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCsplMint

`func (o *CsplUnwrapRequest) SetCsplMint(v string)`

SetCsplMint sets CsplMint field to given value.


### GetEncryptedAmount

`func (o *CsplUnwrapRequest) GetEncryptedAmount() string`

GetEncryptedAmount returns the EncryptedAmount field if non-nil, zero value otherwise.

### GetEncryptedAmountOk

`func (o *CsplUnwrapRequest) GetEncryptedAmountOk() (*string, bool)`

GetEncryptedAmountOk returns a tuple with the EncryptedAmount field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEncryptedAmount

`func (o *CsplUnwrapRequest) SetEncryptedAmount(v string)`

SetEncryptedAmount sets EncryptedAmount field to given value.


### GetOwner

`func (o *CsplUnwrapRequest) GetOwner() string`

GetOwner returns the Owner field if non-nil, zero value otherwise.

### GetOwnerOk

`func (o *CsplUnwrapRequest) GetOwnerOk() (*string, bool)`

GetOwnerOk returns a tuple with the Owner field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOwner

`func (o *CsplUnwrapRequest) SetOwner(v string)`

SetOwner sets Owner field to given value.


### GetProof

`func (o *CsplUnwrapRequest) GetProof() string`

GetProof returns the Proof field if non-nil, zero value otherwise.

### GetProofOk

`func (o *CsplUnwrapRequest) GetProofOk() (*string, bool)`

GetProofOk returns a tuple with the Proof field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetProof

`func (o *CsplUnwrapRequest) SetProof(v string)`

SetProof sets Proof field to given value.

### HasProof

`func (o *CsplUnwrapRequest) HasProof() bool`

HasProof returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


