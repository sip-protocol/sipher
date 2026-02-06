# SolanaTransferData

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Type** | **string** |  | 
**Transaction** | **string** | Base64-encoded unsigned transaction | 
**Mint** | Pointer to **string** |  | [optional] 

## Methods

### NewSolanaTransferData

`func NewSolanaTransferData(type_ string, transaction string, ) *SolanaTransferData`

NewSolanaTransferData instantiates a new SolanaTransferData object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewSolanaTransferDataWithDefaults

`func NewSolanaTransferDataWithDefaults() *SolanaTransferData`

NewSolanaTransferDataWithDefaults instantiates a new SolanaTransferData object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetType

`func (o *SolanaTransferData) GetType() string`

GetType returns the Type field if non-nil, zero value otherwise.

### GetTypeOk

`func (o *SolanaTransferData) GetTypeOk() (*string, bool)`

GetTypeOk returns a tuple with the Type field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetType

`func (o *SolanaTransferData) SetType(v string)`

SetType sets Type field to given value.


### GetTransaction

`func (o *SolanaTransferData) GetTransaction() string`

GetTransaction returns the Transaction field if non-nil, zero value otherwise.

### GetTransactionOk

`func (o *SolanaTransferData) GetTransactionOk() (*string, bool)`

GetTransactionOk returns a tuple with the Transaction field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTransaction

`func (o *SolanaTransferData) SetTransaction(v string)`

SetTransaction sets Transaction field to given value.


### GetMint

`func (o *SolanaTransferData) GetMint() string`

GetMint returns the Mint field if non-nil, zero value otherwise.

### GetMintOk

`func (o *SolanaTransferData) GetMintOk() (*string, bool)`

GetMintOk returns a tuple with the Mint field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMint

`func (o *SolanaTransferData) SetMint(v string)`

SetMint sets Mint field to given value.

### HasMint

`func (o *SolanaTransferData) HasMint() bool`

HasMint returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


