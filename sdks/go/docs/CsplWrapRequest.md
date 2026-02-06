# CsplWrapRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Mint** | **string** | SPL token mint address | 
**Amount** | **string** | Positive integer as string (no leading zeros) | 
**Owner** | **string** | Base58-encoded Solana public key | 
**CreateAccount** | Pointer to **bool** | Create C-SPL account if missing | [optional] [default to true]

## Methods

### NewCsplWrapRequest

`func NewCsplWrapRequest(mint string, amount string, owner string, ) *CsplWrapRequest`

NewCsplWrapRequest instantiates a new CsplWrapRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCsplWrapRequestWithDefaults

`func NewCsplWrapRequestWithDefaults() *CsplWrapRequest`

NewCsplWrapRequestWithDefaults instantiates a new CsplWrapRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetMint

`func (o *CsplWrapRequest) GetMint() string`

GetMint returns the Mint field if non-nil, zero value otherwise.

### GetMintOk

`func (o *CsplWrapRequest) GetMintOk() (*string, bool)`

GetMintOk returns a tuple with the Mint field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMint

`func (o *CsplWrapRequest) SetMint(v string)`

SetMint sets Mint field to given value.


### GetAmount

`func (o *CsplWrapRequest) GetAmount() string`

GetAmount returns the Amount field if non-nil, zero value otherwise.

### GetAmountOk

`func (o *CsplWrapRequest) GetAmountOk() (*string, bool)`

GetAmountOk returns a tuple with the Amount field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAmount

`func (o *CsplWrapRequest) SetAmount(v string)`

SetAmount sets Amount field to given value.


### GetOwner

`func (o *CsplWrapRequest) GetOwner() string`

GetOwner returns the Owner field if non-nil, zero value otherwise.

### GetOwnerOk

`func (o *CsplWrapRequest) GetOwnerOk() (*string, bool)`

GetOwnerOk returns a tuple with the Owner field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOwner

`func (o *CsplWrapRequest) SetOwner(v string)`

SetOwner sets Owner field to given value.


### GetCreateAccount

`func (o *CsplWrapRequest) GetCreateAccount() bool`

GetCreateAccount returns the CreateAccount field if non-nil, zero value otherwise.

### GetCreateAccountOk

`func (o *CsplWrapRequest) GetCreateAccountOk() (*bool, bool)`

GetCreateAccountOk returns a tuple with the CreateAccount field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCreateAccount

`func (o *CsplWrapRequest) SetCreateAccount(v bool)`

SetCreateAccount sets CreateAccount field to given value.

### HasCreateAccount

`func (o *CsplWrapRequest) HasCreateAccount() bool`

HasCreateAccount returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


